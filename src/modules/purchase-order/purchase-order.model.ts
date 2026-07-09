import { and, asc, count, desc, eq, ilike, isNull, inArray, ne, or } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import {
  purchaseOrders,
  purchaseOrderDetails,
  purchaseOrderRequests,
  purchaseOrderApprovals,
} from "./purchase-order.schema";
import { purchaseRequests } from "../purchase-request/purchase-request.schema";
import { toPurchaseOrderDTO, type PurchaseOrderDTO } from "./purchase-order.dto";
import { roles, userWarehouseRoles, userWarehouseMappings } from "../role/role.schema";

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

function buildFilterCondition(params: { filterColumn?: string; searchTerm?: string; status?: number; warehouseId?: string; vendorId?: string; visibleWarehouseIds?: string[] }) {
  const { searchTerm, status, warehouseId, vendorId, visibleWarehouseIds } = params;
  let conds = isNull(purchaseOrders.deletedAt);
  if (status !== undefined) conds = and(conds, eq(purchaseOrders.status, status))!;
  if (warehouseId) conds = and(conds, eq(purchaseOrders.warehouseId, warehouseId))!;
  if (vendorId) conds = and(conds, eq(purchaseOrders.vendorId, vendorId))!;
  if (visibleWarehouseIds !== undefined) {
    if (visibleWarehouseIds.length === 0) {
      // If array is empty, user is mapped to 0 warehouses => they shouldn't see anything.
      conds = and(conds, eq(purchaseOrders.warehouseId, "00000000-0000-0000-0000-000000000000"))!;
    } else {
      conds = and(conds, inArray(purchaseOrders.warehouseId, visibleWarehouseIds))!;
    }
    // Only superadmin and admin (visibleWarehouseIds === undefined) can see drafts.
    // Others can only see POs that are no longer drafts (status != 0).
    conds = and(conds, ne(purchaseOrders.status, 0))!;
  }
  if (searchTerm && searchTerm.trim() !== "") {
    conds = and(conds, ilike(purchaseOrders.code, `%${searchTerm.trim()}%`))!;
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
    sequence = parseInt(lastPO[0].code.replace(prefix, ""), 10) + 1;
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
    visibleWarehouseIds?: string[];
  }): Promise<PurchaseOrderDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, status, warehouseId, vendorId, visibleWarehouseIds } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition({ filterColumn, searchTerm, status, warehouseId, vendorId, visibleWarehouseIds });
    const offset = (page - 1) * limit;

    const result = await db.query.purchaseOrders.findMany({
      where: whereClause,
      orderBy: direction === "asc" ? asc(column) : desc(column),
      limit,
      offset,
      with: {
        vendor: true,
        warehouse: true,
        quotationPlan: true,
        purchaseRequests: {
          with: { purchaseRequest: true },
        },
      },
    });

    return result.map(toPurchaseOrderDTO);
  }

  static async countAll(params: { searchTerm?: string; filterColumn?: string; status?: number; warehouseId?: string; vendorId?: string; visibleWarehouseIds?: string[] }): Promise<number> {
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
        purchaseRequests: {
          with: {
            purchaseRequest: {
              with: { details: { with: { item: true } } },
            },
          },
        },
        details: {
          where: isNull(purchaseOrderDetails.deletedAt),
          with: { 
            item: true,
            quotationPlanDetail: {
              with: {
                quotationPlan: true
              }
            }
          },
        },
        approvals: {
          with: { approver: true },
          orderBy: asc(purchaseOrderApprovals.stage),
        },
      },
    });
    return result ? toPurchaseOrderDTO(result) : undefined;
  }

  static async create(
    payload: {
      purchaseRequestIds?: string[] | null;
      vendorId: string;
      warehouseId: string;
      orderDate: string;
      expectedDeliveryDate?: string | null;
      tax: number;
      discountPercentage: number;
      discount: number;
      shippingFee: number;
      description?: string | null;
      termsConditions?: string | null;
      termOfPayment?: string | null;
      details: { itemId: string; quantity: number; price: number; purchaseRequestDetailId?: string | null; remark?: string | null; attachmentUrl?: string | null }[];
    },
    userId?: string
  ): Promise<PurchaseOrderDTO | undefined> {
    const result = await db.transaction(async (tx) => {
      // Validate that all associated PRs match the PO's warehouseId
      if (payload.purchaseRequestIds && payload.purchaseRequestIds.length > 0) {
        const prs = await tx
          .select({ warehouseId: purchaseRequests.warehouseId })
          .from(purchaseRequests)
          .where(inArray(purchaseRequests.id, payload.purchaseRequestIds));
        
        const invalidPr = prs.find(pr => pr.warehouseId !== payload.warehouseId);
        if (invalidPr) {
          throw new Error("Semua Purchase Request yang dipilih harus memiliki gudang tujuan yang sama dengan Purchase Order.");
        }
      }

      const code = await generatePOCode();
      const subTotal = payload.details.reduce((acc, curr) => acc + curr.quantity * curr.price, 0);
      const grandTotal = subTotal + payload.tax + payload.shippingFee - payload.discount;

      const [po] = await tx.insert(purchaseOrders).values({
        code,
        orderDate: payload.orderDate,
        expectedDeliveryDate: payload.expectedDeliveryDate,
        vendorId: payload.vendorId,
        warehouseId: payload.warehouseId,
        description: payload.description,
        termsConditions: payload.termsConditions,
        termOfPayment: payload.termOfPayment ?? null,
        status: 0,
        currentApprovalStage: 0,
        totalPrice: subTotal.toString(),
        tax: payload.tax.toString(),
        discountPercentage: payload.discountPercentage.toString(),
        discount: payload.discount.toString(),
        shippingFee: payload.shippingFee.toString(),
        grandTotal: grandTotal.toString(),
        createdBy: userId,
        updatedBy: userId,
      }).returning();

      if (!po) throw new Error("Failed to insert PO header");

      await tx.insert(purchaseOrderDetails).values(
        payload.details.map(d => ({
          purchaseOrderId: po.id,
          itemId: d.itemId,
          purchaseRequestDetailId: d.purchaseRequestDetailId ?? null,
          quantity: d.quantity,
          receivedQuantity: 0,
          price: d.price.toString(),
          totalPrice: (d.quantity * d.price).toString(),
          remark: d.remark ?? null,
          attachmentUrl: d.attachmentUrl ?? null,
          createdBy: userId,
          updatedBy: userId,
        }))
      );

      if (payload.purchaseRequestIds && payload.purchaseRequestIds.length > 0) {
        await tx.insert(purchaseOrderRequests).values(
          payload.purchaseRequestIds.map(prId => ({
            purchaseOrderId: po.id,
            purchaseRequestId: prId,
            createdBy: userId,
            updatedBy: userId,
          }))
        );
      }

      return po;
    });

    return result ? await this.findById(result.id) : undefined;
  }

  static async update(
    id: string,
    payload: {
      purchaseRequestIds?: string[] | null;
      vendorId?: string;
      warehouseId?: string;
      orderDate?: string;
      expectedDeliveryDate?: string | null;
      tax?: number;
      discountPercentage?: number;
      discount?: number;
      shippingFee?: number;
      description?: string | null;
      termsConditions?: string | null;
      termOfPayment?: string | null;
      details?: { itemId: string; quantity: number; price: number; purchaseRequestDetailId?: string | null; quotationPlanDetailId?: string | null; remark?: string | null; attachmentUrl?: string | null }[];
    },
    userId?: string
  ): Promise<PurchaseOrderDTO | undefined> {
    const result = await db.transaction(async (tx) => {
      const [existingPo] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
      if (!existingPo) throw new Error("PO not found");
      if (existingPo.status !== 0) throw new Error("Hanya PO berstatus Draft yang dapat diubah.");

      // Validate that all associated PRs match the PO's warehouseId
      const finalWarehouseId = payload.warehouseId !== undefined ? payload.warehouseId : existingPo.warehouseId;
      let finalPRIds = payload.purchaseRequestIds;
      if (finalPRIds === undefined) {
        const existingPRs = await tx.select({ prId: purchaseOrderRequests.purchaseRequestId }).from(purchaseOrderRequests).where(eq(purchaseOrderRequests.purchaseOrderId, id));
        finalPRIds = existingPRs.map(r => r.prId);
      }

      if (finalPRIds && finalPRIds.length > 0) {
        const prs = await tx
          .select({ warehouseId: purchaseRequests.warehouseId })
          .from(purchaseRequests)
          .where(inArray(purchaseRequests.id, finalPRIds));
        
        const invalidPr = prs.find(pr => pr.warehouseId !== finalWarehouseId);
        if (invalidPr) {
          throw new Error("Semua Purchase Request yang dipilih harus memiliki gudang tujuan yang sama dengan Purchase Order.");
        }
      }

      const headerPayload: any = { updatedAt: new Date(), updatedBy: userId };
      if (payload.vendorId !== undefined) headerPayload.vendorId = payload.vendorId;
      if (payload.warehouseId !== undefined) headerPayload.warehouseId = payload.warehouseId;
      if (payload.orderDate !== undefined) headerPayload.orderDate = payload.orderDate;
      if (payload.expectedDeliveryDate !== undefined) headerPayload.expectedDeliveryDate = payload.expectedDeliveryDate;
      if (payload.description !== undefined) headerPayload.description = payload.description;
      if (payload.termsConditions !== undefined) headerPayload.termsConditions = payload.termsConditions;
      if (payload.termOfPayment !== undefined) headerPayload.termOfPayment = payload.termOfPayment;
      if (payload.tax !== undefined) headerPayload.tax = payload.tax.toString();
      if (payload.discountPercentage !== undefined) headerPayload.discountPercentage = payload.discountPercentage.toString();
      if (payload.discount !== undefined) headerPayload.discount = payload.discount.toString();
      if (payload.shippingFee !== undefined) headerPayload.shippingFee = payload.shippingFee.toString();

      if (payload.details && payload.details.length > 0) {
        const subTotal = payload.details.reduce((acc, curr) => acc + curr.quantity * curr.price, 0);
        headerPayload.totalPrice = subTotal.toString();
        const currentTax = payload.tax !== undefined ? payload.tax : parseFloat(existingPo.tax as string);
        const currentDiscount = payload.discount !== undefined ? payload.discount : parseFloat(existingPo.discount as string);
        const currentShipping = payload.shippingFee !== undefined ? payload.shippingFee : parseFloat(existingPo.shippingFee as string);
        headerPayload.grandTotal = (subTotal + currentTax + currentShipping - currentDiscount).toString();
      }

      const [po] = await tx
        .update(purchaseOrders)
        .set(headerPayload)
        .where(and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)))
        .returning();
      if (!po) throw new Error("PO not found");

      if (payload.details && payload.details.length > 0) {
        await tx.delete(purchaseOrderDetails).where(eq(purchaseOrderDetails.purchaseOrderId, id));
        await tx.insert(purchaseOrderDetails).values(
          payload.details.map(d => ({
            purchaseOrderId: id,
            itemId: d.itemId,
            purchaseRequestDetailId: d.purchaseRequestDetailId ?? null,
            quotationPlanDetailId: d.quotationPlanDetailId ?? null,
            quantity: d.quantity,
            receivedQuantity: 0,
            price: d.price.toString(),
            totalPrice: (d.quantity * d.price).toString(),
            remark: d.remark ?? null,
            attachmentUrl: d.attachmentUrl ?? null,
            createdBy: userId,
            updatedBy: userId,
          }))
        );
      }

      if (payload.purchaseRequestIds !== undefined && payload.purchaseRequestIds !== null) {
        await tx.delete(purchaseOrderRequests).where(eq(purchaseOrderRequests.purchaseOrderId, id));
        if (payload.purchaseRequestIds.length > 0) {
          await tx.insert(purchaseOrderRequests).values(
            payload.purchaseRequestIds.map(prId => ({
              purchaseOrderId: id,
              purchaseRequestId: prId,
              createdBy: userId,
              updatedBy: userId,
            }))
          );
        }
      }

      return po;
    });

    return await this.findById(result.id);
  }

  /**
   * Submit PO for Approval: Draft (0) → Pending Approval (1)
   * Inserts all 3 approval stage records.
   */
  static async submit(id: string, userId: string): Promise<PurchaseOrderDTO | undefined> {
    await db.transaction(async (tx) => {
      const po = await tx.query.purchaseOrders.findFirst({
        where: and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)),
      });
      if (!po) throw new Error("Purchase order not found");
      if (po.status !== 0) throw new Error("Hanya PO berstatus Draft yang dapat di-submit.");

      await tx.insert(purchaseOrderApprovals).values([
        { purchaseOrderId: id, stage: 0, status: 0, createdBy: userId, updatedBy: userId },
        { purchaseOrderId: id, stage: 1, status: 0, createdBy: userId, updatedBy: userId },
        { purchaseOrderId: id, stage: 2, status: 0, createdBy: userId, updatedBy: userId },
      ]);

      await tx.update(purchaseOrders)
        .set({ status: 1, currentApprovalStage: 0, updatedAt: new Date(), updatedBy: userId })
        .where(eq(purchaseOrders.id, id));
    });
    return await this.findById(id);
  }

  /**
   * Approve or Reject PO. Role-gated per currentApprovalStage:
   *   Stage 0 = Warehouse Head, Stage 1 = Branch Head, Stage 2 = Manager
   */
  static async patchApprovalStatus(
    id: string,
    payload: { action: "approve" | "reject"; remark?: string | null },
    userId: string
  ): Promise<PurchaseOrderDTO | undefined> {
    await db.transaction(async (tx) => {
      const po = await tx.query.purchaseOrders.findFirst({
        where: and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)),
      });
      if (!po) throw new Error("Purchase order not found");
      if (po.status !== 1) throw new Error("PO tidak sedang dalam status menunggu persetujuan.");

      const userRoles = await tx
        .select({ roleCode: roles.code })
        .from(userWarehouseRoles)
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(and(eq(userWarehouseRoles.userId, userId), isNull(userWarehouseRoles.deletedAt)));

      const userWHMappings = await tx
        .select({ warehouseId: userWarehouseMappings.warehouseId })
        .from(userWarehouseMappings)
        .where(and(eq(userWarehouseMappings.userId, userId), eq(userWarehouseMappings.isActive, true), isNull(userWarehouseMappings.deletedAt)));

      const isSuperadmin = userRoles.some(r => r.roleCode === "superadmin");
      const userWHIds = userWHMappings.map(m => m.warehouseId);
      const isForThisWarehouse = userWHIds.includes(po.warehouseId);
      const isWarehouseHead = userRoles.some(r => r.roleCode === "warehouse_head") && isForThisWarehouse;
      const isBranchHead = userRoles.some(r => r.roleCode === "branch_head") && isForThisWarehouse;
      const isManager = userRoles.some(r => r.roleCode === "manager");

      const stage = po.currentApprovalStage;

      if (payload.action === "reject") {
        let canReject = isSuperadmin;
        if (stage === 0 && isWarehouseHead) canReject = true;
        if (stage === 1 && isBranchHead) canReject = true;
        if (stage === 2 && isManager) canReject = true;
        if (!canReject) throw new Error("Anda tidak memiliki akses untuk menolak PO pada tahap ini.");

        await tx.update(purchaseOrderApprovals)
          .set({ status: 2, approvedBy: userId, approvedAt: new Date(), remark: payload.remark ?? null, updatedAt: new Date(), updatedBy: userId })
          .where(and(eq(purchaseOrderApprovals.purchaseOrderId, id), eq(purchaseOrderApprovals.stage, stage)));

        await tx.update(purchaseOrders)
          .set({ status: 3, updatedAt: new Date(), updatedBy: userId })
          .where(eq(purchaseOrders.id, id));
      } else {
        let canApprove = isSuperadmin;
        if (stage === 0 && isWarehouseHead) canApprove = true;
        if (stage === 1 && isBranchHead) canApprove = true;
        if (stage === 2 && isManager) canApprove = true;
        if (!canApprove) throw new Error("Anda tidak memiliki akses untuk menyetujui PO pada tahap ini.");

        await tx.update(purchaseOrderApprovals)
          .set({ status: 1, approvedBy: userId, approvedAt: new Date(), remark: payload.remark ?? null, updatedAt: new Date(), updatedBy: userId })
          .where(and(eq(purchaseOrderApprovals.purchaseOrderId, id), eq(purchaseOrderApprovals.stage, stage)));

        const nextPending = await tx.query.purchaseOrderApprovals.findFirst({
          where: and(
            eq(purchaseOrderApprovals.purchaseOrderId, id),
            eq(purchaseOrderApprovals.status, 0),
            isNull(purchaseOrderApprovals.deletedAt)
          ),
          orderBy: asc(purchaseOrderApprovals.stage),
        });

        if (nextPending) {
          await tx.update(purchaseOrders)
            .set({ currentApprovalStage: nextPending.stage, updatedAt: new Date(), updatedBy: userId })
            .where(eq(purchaseOrders.id, id));
        } else {
          await tx.update(purchaseOrders)
            .set({ status: 2, currentApprovalStage: 3, approvedBy: userId, approvedAt: new Date(), updatedAt: new Date(), updatedBy: userId })
            .where(eq(purchaseOrders.id, id));
        }
      }
    });

    return await this.findById(id);
  }

  /**
   * Simple status patch (e.g. mark as Sent after approval).
   * Only allowed for status 4 (Sent) transition from Approved (2).
   */
  static async patchStatus(id: string, status: number): Promise<PurchaseOrderDTO | undefined> {
    await db
      .update(purchaseOrders)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)));
    return await this.findById(id);
  }

  static async receiveGoods(id: string, items: { detailId: string; receivedQuantity: number }[]): Promise<PurchaseOrderDTO | undefined> {
    await db.transaction(async (tx) => {
      const po = await tx.query.purchaseOrders.findFirst({
        where: and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)),
      });
      if (!po) throw new Error("PO not found");
      if (po.status !== 4 && po.status !== 5) throw new Error("Hanya PO yang sudah dikirim (status Sent atau Partial) yang bisa menerima barang.");

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
          newReceivedQty = Math.min(newReceivedQty + itemToReceive.receivedQuantity, existingDetail.quantity);
          await tx
            .update(purchaseOrderDetails)
            .set({ receivedQuantity: newReceivedQty, updatedAt: new Date() })
            .where(eq(purchaseOrderDetails.id, existingDetail.id));
        }
        if (newReceivedQty < existingDetail.quantity) allFullyReceived = false;
        if (newReceivedQty > 0) atLeastOnePartial = true;
      }

      let newStatus = 4;
      if (allFullyReceived) newStatus = 6;
      else if (atLeastOnePartial) newStatus = 5;

      await tx.update(purchaseOrders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, id));
    });

    return await this.findById(id);
  }

  static async softDelete(id: string, userId?: string): Promise<boolean> {
    const po = await db.query.purchaseOrders.findFirst({
      where: and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)),
    });
    if (!po) return false;

    const result = await db
      .update(purchaseOrders)
      .set({ status: 7, updatedAt: new Date(), updatedBy: userId })
      .where(and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt)))
      .returning({ id: purchaseOrders.id });
    return result.length > 0;
  }
}
