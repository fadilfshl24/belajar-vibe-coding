import { and, asc, count, desc, eq, ilike, isNull, inArray } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { purchaseOrders, purchaseOrderDetails } from "./purchase-order.schema";
import { toPurchaseOrderDTO, type PurchaseOrderDTO } from "./purchase-order.dto";
import type { PurchaseOrderRecord } from "./purchase-order.schema";

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: purchaseOrders.id,
    Code: purchaseOrders.code,
    OrderDate: purchaseOrders.orderDate,
    Status: purchaseOrders.status,
    CreatedAt: purchaseOrders.createdAt,
    UpdatedAt: purchaseOrders.updatedAt,
  };
  return (map[key] ?? purchaseOrders.createdAt) as AnyColumn;
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
    return { column: purchaseOrders.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(params: { filterColumn?: string; searchTerm?: string; status?: number; warehouseId?: string; vendorId?: string }) {
  const { filterColumn, searchTerm, status, warehouseId, vendorId } = params;
  let conds = isNull(purchaseOrders.deletedAt);
  if (status !== undefined) {
    conds = and(conds, eq(purchaseOrders.status, status))!;
  }
  if (warehouseId) {
    conds = and(conds, eq(purchaseOrders.warehouseId, warehouseId))!;
  }
  if (vendorId) {
    conds = and(conds, eq(purchaseOrders.vendorId, vendorId))!;
  }
  if (searchTerm) {
    const term = searchTerm.trim();
    if (term !== "") {
      conds = and(conds, ilike(purchaseOrders.code, `%${term}%`))!;
    }
  }
  return conds;
}

async function generatePOCode(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PO-${dateStr}-`;
  
  const lastPO = await db
    .select({ code: purchaseOrders.code })
    .from(purchaseOrders)
    .where(ilike(purchaseOrders.code, `${prefix}%`))
    .orderBy(desc(purchaseOrders.code))
    .limit(1);

  let sequence = 1;
  if (lastPO.length > 0 && lastPO[0]) {
    const lastCode = lastPO[0].code;
    const seqStr = lastCode.replace(prefix, "");
    sequence = parseInt(seqStr, 10) + 1;
  }
  
  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

export class PurchaseOrderModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    status?: number;
    warehouseId?: string;
    vendorId?: string;
  }): Promise<PurchaseOrderDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, status, warehouseId, vendorId } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition({ filterColumn, searchTerm, status, warehouseId, vendorId });
    const offset = (page - 1) * limit;

    const result = await db.query.purchaseOrders.findMany({
      where: whereClause,
      orderBy: direction === "asc" ? asc(column) : desc(column),
      limit: limit,
      offset: offset,
      with: {
        vendor: true,
        warehouse: true,
      }
    });

    return result.map(toPurchaseOrderDTO);
  }

  static async countAll(params: { searchTerm?: string; filterColumn?: string; status?: number; warehouseId?: string; vendorId?: string }): Promise<number> {
    const whereClause = buildFilterCondition(params);
    const result = await db.select({ total: count() }).from(purchaseOrders).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<PurchaseOrderDTO | undefined> {
    const result = await db.query.purchaseOrders.findFirst({
      where: and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)),
      with: {
        vendor: true,
        warehouse: true,
        purchaseRequest: true,
        details: {
          where: isNull(purchaseOrderDetails.deletedAt),
          with: {
            item: true
          }
        }
      }
    });
    return result ? toPurchaseOrderDTO(result) : undefined;
  }

  static async create(payload: {
    purchaseRequestId?: string | null;
    vendorId: string;
    warehouseId: string;
    orderDate: string;
    expectedDeliveryDate?: string;
    tax: number;
    discount: number;
    shippingFee: number;
    description?: string;
    details: { itemId: string; quantity: number; price: number }[];
  }): Promise<PurchaseOrderDTO | undefined> {
    const result = await db.transaction(async (tx) => {
      const code = await generatePOCode();
      
      const subTotal = payload.details.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);
      const grandTotal = subTotal + payload.tax + payload.shippingFee - payload.discount;
      
      const [po] = await tx.insert(purchaseOrders).values({
        code,
        orderDate: payload.orderDate,
        expectedDeliveryDate: payload.expectedDeliveryDate,
        purchaseRequestId: payload.purchaseRequestId,
        vendorId: payload.vendorId,
        warehouseId: payload.warehouseId,
        description: payload.description,
        status: 0, // Draft
        totalPrice: subTotal.toString(),
        tax: payload.tax.toString(),
        discount: payload.discount.toString(),
        shippingFee: payload.shippingFee.toString(),
        grandTotal: grandTotal.toString(),
      }).returning();
      
      if (!po) throw new Error("Failed to insert PO header");

      const detailsToInsert = payload.details.map(d => ({
        purchaseOrderId: po.id,
        itemId: d.itemId,
        quantity: d.quantity,
        receivedQuantity: 0,
        price: d.price.toString(),
        totalPrice: (d.quantity * d.price).toString(),
      }));

      await tx.insert(purchaseOrderDetails).values(detailsToInsert);
      
      return po;
    });

    if (result) {
      return await this.findById(result.id);
    }
    return undefined;
  }

  static async update(
    id: string,
    payload: {
      purchaseRequestId?: string | null;
      vendorId?: string;
      warehouseId?: string;
      orderDate?: string;
      expectedDeliveryDate?: string;
      tax?: number;
      discount?: number;
      shippingFee?: number;
      description?: string;
      details?: { itemId: string; quantity: number; price: number }[];
    }
  ): Promise<PurchaseOrderDTO | undefined> {
    const result = await db.transaction(async (tx) => {
      // Get existing PO for current values if we need to calculate grand total
      const [existingPo] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
      if (!existingPo) throw new Error("PO not found");

      // 1. Update Header
      const headerPayload: any = { updatedAt: new Date() };
      if (payload.purchaseRequestId !== undefined) headerPayload.purchaseRequestId = payload.purchaseRequestId;
      if (payload.vendorId !== undefined) headerPayload.vendorId = payload.vendorId;
      if (payload.warehouseId !== undefined) headerPayload.warehouseId = payload.warehouseId;
      if (payload.orderDate !== undefined) headerPayload.orderDate = payload.orderDate;
      if (payload.expectedDeliveryDate !== undefined) headerPayload.expectedDeliveryDate = payload.expectedDeliveryDate;
      if (payload.description !== undefined) headerPayload.description = payload.description;
      
      if (payload.tax !== undefined) headerPayload.tax = payload.tax.toString();
      if (payload.discount !== undefined) headerPayload.discount = payload.discount.toString();
      if (payload.shippingFee !== undefined) headerPayload.shippingFee = payload.shippingFee.toString();

      // Recalculate Subtotal & GrandTotal if details or financial numbers changed
      if (payload.details && payload.details.length > 0) {
        const subTotal = payload.details.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);
        headerPayload.totalPrice = subTotal.toString();
        
        const currentTax = payload.tax !== undefined ? payload.tax : parseFloat(existingPo.tax as string);
        const currentDiscount = payload.discount !== undefined ? payload.discount : parseFloat(existingPo.discount as string);
        const currentShipping = payload.shippingFee !== undefined ? payload.shippingFee : parseFloat(existingPo.shippingFee as string);
        
        const grandTotal = subTotal + currentTax + currentShipping - currentDiscount;
        headerPayload.grandTotal = grandTotal.toString();
      }
      
      const [po] = await tx
        .update(purchaseOrders)
        .set(headerPayload)
        .where(and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)))
        .returning();
        
      if (!po) throw new Error("PO not found");
      
      // 2. Update Details if provided (delete all existing and recreate for simplicity)
      // Note: This logic assumes PO is still Draft. If receivedQuantity > 0, we shouldn't simply delete.
      // But we enforce update only on Draft at the controller level.
      if (payload.details && payload.details.length > 0) {
        await tx.delete(purchaseOrderDetails).where(eq(purchaseOrderDetails.purchaseOrderId, id));
        
        const detailsToInsert = payload.details.map(d => ({
          purchaseOrderId: id,
          itemId: d.itemId,
          quantity: d.quantity,
          receivedQuantity: 0,
          price: d.price.toString(),
          totalPrice: (d.quantity * d.price).toString(),
        }));
        await tx.insert(purchaseOrderDetails).values(detailsToInsert);
      }
      
      return po;
    });
    
    return await this.findById(result.id);
  }

  static async patchStatus(id: string, status: number): Promise<PurchaseOrderDTO | undefined> {
    await db
      .update(purchaseOrders)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)));
      
    return await this.findById(id);
  }

  static async receiveGoods(id: string, items: { detailId: string; receivedQuantity: number }[]): Promise<PurchaseOrderDTO | undefined> {
    await db.transaction(async (tx) => {
      // Get all existing details for this PO
      const existingDetails = await tx
        .select()
        .from(purchaseOrderDetails)
        .where(and(eq(purchaseOrderDetails.purchaseOrderId, id), isNull(purchaseOrderDetails.deletedAt)));

      if (existingDetails.length === 0) throw new Error("PO Details not found");

      let allFullyReceived = true;
      let atLeastOnePartial = false;

      for (const existingDetail of existingDetails) {
        const itemToReceive = items.find(i => i.detailId === existingDetail.id);
        
        let newReceivedQty = existingDetail.receivedQuantity;
        if (itemToReceive) {
          newReceivedQty += itemToReceive.receivedQuantity;
          // Ensure we don't receive more than ordered (optional business logic, but typical)
          if (newReceivedQty > existingDetail.quantity) {
             newReceivedQty = existingDetail.quantity; // Cap at ordered qty or throw error
          }
          
          await tx
            .update(purchaseOrderDetails)
            .set({ receivedQuantity: newReceivedQty, updatedAt: new Date() })
            .where(eq(purchaseOrderDetails.id, existingDetail.id));
        }

        if (newReceivedQty < existingDetail.quantity) {
          allFullyReceived = false;
        }
        if (newReceivedQty > 0) {
          atLeastOnePartial = true;
        }
      }

      // Update PO Status based on received quantities
      let newStatus = 1; // Sent
      if (allFullyReceived) {
        newStatus = 3; // Fully Received
      } else if (atLeastOnePartial) {
        newStatus = 2; // Partially Received
      }

      await tx
        .update(purchaseOrders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, id));
    });

    return await this.findById(id);
  }

  static async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(purchaseOrders)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)))
      .returning({ id: purchaseOrders.id });
    return result.length > 0;
  }
}
