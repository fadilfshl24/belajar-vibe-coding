import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { purchaseRequests, purchaseRequestDetails } from "./purchase-request.schema";
import { toPurchaseRequestDTO, type PurchaseRequestDTO } from "./purchase-request.dto";
import type { PurchaseRequestRecord } from "./purchase-request.schema";

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: purchaseRequests.id,
    Code: purchaseRequests.code,
    RequestDate: purchaseRequests.requestDate,
    Status: purchaseRequests.status,
    CreatedAt: purchaseRequests.createdAt,
    UpdatedAt: purchaseRequests.updatedAt,
  };
  return (map[key] ?? purchaseRequests.createdAt) as AnyColumn;
}

function parseOrderBy(orderBy: string): { column: AnyColumn; direction: "asc" | "desc" } {
  try {
    const normalized = orderBy.replace(/'/g, '"');
    const parsed = JSON.parse(normalized) as Record<string, string>;
    const [key, dir] = Object.entries(parsed)[0] ?? ["CreatedAt", "DESC"];
    return {
      column: resolveOrderColumn(key),
      direction: (dir?.toUpperCase() === "ASC" ? "asc" : "desc") as "asc" | "desc",
    };
  } catch {
    return { column: purchaseRequests.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(params: { filterColumn?: string; searchTerm?: string; status?: number; warehouseId?: string; customerId?: string }) {
  const { filterColumn, searchTerm, status, warehouseId, customerId } = params;
  let conds = isNull(purchaseRequests.deletedAt);
  if (status !== undefined) {
    conds = and(conds, eq(purchaseRequests.status, status))!;
  }
  if (warehouseId) {
    conds = and(conds, eq(purchaseRequests.warehouseId, warehouseId))!;
  }
  if (customerId) {
    conds = and(conds, eq(purchaseRequests.customerId, customerId))!;
  }
  if (searchTerm) {
    const term = searchTerm.trim();
    if (term !== "") {
      conds = and(conds, ilike(purchaseRequests.code, `%${term}%`))!;
    }
  }
  return conds;
}

async function generatePRCode(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PR-${dateStr}-`;
  
  const lastPR = await db
    .select({ code: purchaseRequests.code })
    .from(purchaseRequests)
    .where(ilike(purchaseRequests.code, `${prefix}%`))
    .orderBy(desc(purchaseRequests.code))
    .limit(1);

  let sequence = 1;
  if (lastPR.length > 0 && lastPR[0]) {
    const lastCode = lastPR[0].code;
    const seqStr = lastCode.replace(prefix, "");
    sequence = parseInt(seqStr, 10) + 1;
  }
  
  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

export class PurchaseRequestModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    status?: number;
    warehouseId?: string;
    customerId?: string;
  }): Promise<PurchaseRequestDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, status, warehouseId, customerId } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition({ filterColumn, searchTerm, status, warehouseId, customerId });
    const offset = (page - 1) * limit;

    const result = await db.query.purchaseRequests.findMany({
      where: whereClause,
      orderBy: direction === "asc" ? asc(column) : desc(column),
      limit: limit,
      offset: offset,
      with: {
        customer: true,
        warehouse: true,
        requester: true,
      }
    });

    return result.map(toPurchaseRequestDTO);
  }

  static async countAll(params: { searchTerm?: string; filterColumn?: string; status?: number; warehouseId?: string; customerId?: string }): Promise<number> {
    const whereClause = buildFilterCondition(params);
    const result = await db.select({ total: count() }).from(purchaseRequests).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<PurchaseRequestDTO | undefined> {
    const result = await db.query.purchaseRequests.findFirst({
      where: and(eq(purchaseRequests.id, id), isNull(purchaseRequests.deletedAt)),
      with: {
        customer: true,
        warehouse: true,
        requester: true,
        approver: true,
        details: {
          where: isNull(purchaseRequestDetails.deletedAt),
          with: {
            item: true
          }
        }
      }
    });
    return result ? toPurchaseRequestDTO(result) : undefined;
  }

  static async create(payload: {
    customerId?: string | null;
    warehouseId: string;
    description?: string;
    details: { itemId: string; quantity: number; price: number }[];
  }, userId: string): Promise<PurchaseRequestDTO | undefined> {
    const result = await db.transaction(async (tx) => {
      const code = await generatePRCode();
      const requestDate = new Date().toISOString().slice(0, 10);
      
      const [pr] = await tx.insert(purchaseRequests).values({
        code,
        requestDate,
        customerId: payload.customerId,
        warehouseId: payload.warehouseId,
        description: payload.description,
        status: 0, // Draft
        requestedBy: userId,
      }).returning();
      
      if (!pr) throw new Error("Failed to insert PR header");

      const detailsToInsert = payload.details.map(d => ({
        purchaseRequestId: pr.id,
        itemId: d.itemId,
        quantity: d.quantity,
        price: d.price.toString(),
        totalPrice: (d.quantity * d.price).toString(),
      }));

      await tx.insert(purchaseRequestDetails).values(detailsToInsert);
      
      return pr;
    });

    if (result) {
      return await this.findById(result.id);
    }
    return undefined;
  }

  static async update(
    id: string,
    payload: {
      customerId?: string | null;
      warehouseId?: string;
      description?: string;
      details?: { itemId: string; quantity: number; price: number }[];
    }
  ): Promise<PurchaseRequestDTO | undefined> {
    const result = await db.transaction(async (tx) => {
      // 1. Update Header
      const headerPayload: any = { updatedAt: new Date() };
      if (payload.customerId !== undefined) headerPayload.customerId = payload.customerId;
      if (payload.warehouseId !== undefined) headerPayload.warehouseId = payload.warehouseId;
      if (payload.description !== undefined) headerPayload.description = payload.description;
      
      const [pr] = await tx
        .update(purchaseRequests)
        .set(headerPayload)
        .where(and(eq(purchaseRequests.id, id), isNull(purchaseRequests.deletedAt)))
        .returning();
        
      if (!pr) throw new Error("PR not found");
      
      // 2. Update Details if provided (delete all existing and recreate for simplicity)
      if (payload.details && payload.details.length > 0) {
        await tx.delete(purchaseRequestDetails).where(eq(purchaseRequestDetails.purchaseRequestId, id));
        
        const detailsToInsert = payload.details.map(d => ({
          purchaseRequestId: id,
          itemId: d.itemId,
          quantity: d.quantity,
          price: d.price.toString(),
          totalPrice: (d.quantity * d.price).toString(),
        }));
        await tx.insert(purchaseRequestDetails).values(detailsToInsert);
      }
      
      return pr;
    });
    
    return await this.findById(result.id);
  }

  static async patchStatus(id: string, status: number, userId: string): Promise<PurchaseRequestDTO | undefined> {
    let updatePayload: any = { status, updatedAt: new Date() };
    if (status === 2 || status === 3) { // Approved or Rejected
      updatePayload.approvedBy = userId;
      updatePayload.approvedAt = new Date();
    }
    
    await db
      .update(purchaseRequests)
      .set(updatePayload)
      .where(and(eq(purchaseRequests.id, id), isNull(purchaseRequests.deletedAt)));
      
    return await this.findById(id);
  }

  static async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(purchaseRequests)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(purchaseRequests.id, id), isNull(purchaseRequests.deletedAt)))
      .returning({ id: purchaseRequests.id });
    return result.length > 0;
  }
}
