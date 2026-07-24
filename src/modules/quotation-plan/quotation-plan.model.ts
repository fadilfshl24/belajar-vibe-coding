import { db } from "../../core/db";
import { quotationPlans, quotationPlanDetails } from "./quotation-plan.schema";
import { documentApprovals } from "../approval/document-approval.schema";
import { purchaseRequests, purchaseRequestDetails } from "../purchase-request/purchase-request.schema";
import { purchaseOrders, purchaseOrderDetails, purchaseOrderRequests } from "../purchase-order/purchase-order.schema";
import { itemPriceHistories } from "../item/item.schema";
import { quotationPlanPurchaseRequests } from "./quotation-plan.schema";
import { approvalSteps } from "../approval-step/approval-step.schema";
import { eq, and, sql, or, inArray, desc, ne, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { createQuotationPlanSchema, approvalQPSchema } from "./quotation-plan.validation";
import { NotFoundError } from "elysia";

export class QuotationPlanModel {
  static async create(data: z.infer<typeof createQuotationPlanSchema>, userId: string) {
    return await db.transaction(async (tx) => {
      // Find initial approval status from steps
      const steps = await tx.query.approvalSteps.findMany({
        where: and(eq(approvalSteps.documentType, 'QP'), sql`${approvalSteps.deletedAt} IS NULL`),
        orderBy: (steps, { asc }) => [asc(steps.stage)]
      });
      // If no steps defined, it will auto-approve or need custom logic. Default to status 1 for pending.
      const initialStatus = steps.length > 0 ? 1 : 3;

      // Create header
      const [header] = await tx.insert(quotationPlans).values({
        warehouseId: data.warehouseId,
        code: `QP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 10000)}`,
        description: data.description,
        createdBy: userId,
        status: initialStatus, // Pending First Stage or Approved
        currentApprovalStage: 0,
      }).returning();

      // Insert pivot tables
      const pivotValues = data.purchaseRequestIds.map(prId => ({
        quotationPlanId: header!.id,
        purchaseRequestId: prId,
        createdBy: userId,
      }));
      await tx.insert(quotationPlanPurchaseRequests).values(pivotValues);

      // Insert details
      const detailValues = data.details.map((d) => ({
        quotationPlanId: header!.id,
        purchaseRequestDetailId: d.purchaseRequestDetailId,
        itemId: d.itemId,
        vendorId: d.vendorId,
        requestedQuantity: d.requestedQuantity,
        offeredQuantity: d.offeredQuantity,
        price: d.price.toString(),
        totalPrice: (d.offeredQuantity * d.price).toString(),
        remark: d.remark,
        attachmentUrl: d.attachmentUrl,
        createdBy: userId,
      }));

      await tx.insert(quotationPlanDetails).values(detailValues);

      return header;
    });
  }

  static async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    purchaseRequestId?: string;
    warehouseId?: string;
    warehouseIds?: string[];
    status?: number;
    startDate?: string;
    endDate?: string;
    requiredApprovalStage?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [sql`${quotationPlans.deletedAt} IS NULL`];

    if (params.search) {
      conditions.push(sql`${quotationPlans.code} ILIKE ${`%${params.search}%`}`);
    }
    if (params.status !== undefined) {
      conditions.push(eq(quotationPlans.status, params.status));
    }
    if (params.warehouseId) {
      conditions.push(eq(quotationPlans.warehouseId, params.warehouseId));
    }
    if (params.startDate) {
      const start = new Date(params.startDate);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(quotationPlans.createdAt, start));
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(quotationPlans.createdAt, end));
    }
    if (params.purchaseRequestId) {
      // In a pivot setup, finding by PR ID is more complex. 
      // We would ideally join. For simplicity using a subquery or exist.
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${quotationPlanPurchaseRequests} qpr 
        WHERE qpr.quotation_plan_id = ${quotationPlans.id} 
        AND qpr.purchase_request_id = ${params.purchaseRequestId}
      )`);
    }
    if (params.warehouseIds && params.warehouseIds.length > 0) {
      conditions.push(inArray(quotationPlans.warehouseId, params.warehouseIds));
    }

    // Dynamic approval stage filter:
    // Only show pending QPs (status=1) that are at the user's required stage.
    // Non-pending QPs (completed, rejected, etc.) are always visible.
    if (params.requiredApprovalStage !== undefined) {
      conditions.push(
        sql`(
          (${quotationPlans.status} = 1 AND ${quotationPlans.currentApprovalStage} = ${params.requiredApprovalStage})
          OR ${quotationPlans.status} != 1
        )`
      );
    }

    const rows = await db.query.quotationPlans.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(quotationPlans.createdAt)],
      with: {
        warehouse: true,
        requester: true,
        purchaseRequests: {
          with: {
            purchaseRequest: true
          }
        },
      }
    });

    return rows;
  }

  static async countAll(params: {
    search?: string;
    purchaseRequestId?: string;
    warehouseId?: string;
    warehouseIds?: string[];
    status?: number;
    startDate?: string;
    endDate?: string;
    requiredApprovalStage?: number;
  }) {
    const conditions = [sql`${quotationPlans.deletedAt} IS NULL`];
    if (params.search) {
      conditions.push(sql`${quotationPlans.code} ILIKE ${`%${params.search}%`}`);
    }
    if (params.status !== undefined) {
      conditions.push(eq(quotationPlans.status, params.status));
    }
    if (params.warehouseId) {
      conditions.push(eq(quotationPlans.warehouseId, params.warehouseId));
    }
    if (params.startDate) {
      const start = new Date(params.startDate);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(quotationPlans.createdAt, start));
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(quotationPlans.createdAt, end));
    }
    if (params.purchaseRequestId) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${quotationPlanPurchaseRequests} qpr 
        WHERE qpr.quotation_plan_id = ${quotationPlans.id} 
        AND qpr.purchase_request_id = ${params.purchaseRequestId}
      )`);
    }
    if (params.warehouseIds && params.warehouseIds.length > 0) {
      conditions.push(inArray(quotationPlans.warehouseId, params.warehouseIds));
    }
    if (params.requiredApprovalStage !== undefined) {
      conditions.push(
        sql`(
          (${quotationPlans.status} = 1 AND ${quotationPlans.currentApprovalStage} = ${params.requiredApprovalStage})
          OR ${quotationPlans.status} != 1
        )`
      );
    }

    const [result] = await db.select({ count: sql<number>`count(*)` }).from(quotationPlans).where(and(...conditions));
    return Number(result?.count || 0);
  }

  static async findById(id: string, warehouseIds?: string[]) {
    const conditions = [eq(quotationPlans.id, id), sql`${quotationPlans.deletedAt} IS NULL`];
    if (warehouseIds && warehouseIds.length > 0) {
      conditions.push(inArray(quotationPlans.warehouseId, warehouseIds));
    }
    const qp = await db.query.quotationPlans.findFirst({
      where: and(...conditions),
      with: {
        warehouse: true,
        requester: true,
        purchaseRequests: {
          with: {
            purchaseRequest: true
          }
        },
        details: {
          with: {
            item: {
              with: {
                uom: true,
                category: true,
              }
            },
            vendor: true,
            purchaseRequestDetail: {
              with: {
                purchaseRequest: true
              }
            }
          }
        },
        approvals: {
          with: {
            approver: true
          }
        }
      }
    });

    if (!qp) throw new NotFoundError("Quotation Plan not found");
    return qp;
  }

  static async approve(id: string, stage: number, payload: z.infer<typeof approvalQPSchema>, userId: string) {
    return await db.transaction(async (tx) => {
      const qp = await tx.query.quotationPlans.findFirst({
        where: and(eq(quotationPlans.id, id), sql`${quotationPlans.deletedAt} IS NULL`),
        with: {
          details: true,
        }
      });

      if (!qp) throw new NotFoundError("Quotation Plan not found");

      if (qp.status !== 1 && qp.status !== 2) {
        throw new Error("Quotation Plan is not pending approval");
      }

      if (qp.currentApprovalStage !== stage) {
        throw new Error("Invalid approval stage");
      }

      // Record approval
      await tx.insert(documentApprovals).values({
        documentType: "QP",
        documentId: id,
        stage: stage,
        approvedBy: userId,
        status: payload.status,
        remark: payload.notes,
        createdBy: userId,
      });

      let nextStage = qp.currentApprovalStage;
      let nextStatus = qp.status;

      // Dynamic approval resolution
      const steps = await tx.query.approvalSteps.findMany({
        where: and(eq(approvalSteps.documentType, 'QP'), sql`${approvalSteps.deletedAt} IS NULL`),
        orderBy: (steps, { asc }) => [asc(steps.stage)]
      });

      if (payload.status === 2) { // Rejected
        nextStatus = 4;
      } else if (payload.status === 1) { // Approved
        const isLastStage = stage >= steps.length - 1;
        if (isLastStage) {
          nextStatus = 3; // Fully Approved
        } else {
          nextStage = stage + 1;
          nextStatus = 2; // Keep pending or custom logic. For simplicity, 1 is pending first, 2 is pending next stages. Let's just use status=1 as pending approval generally, but frontend expects 1/2 for WH/Branch. We'll use 2 for all subsequent stages.
        }
      }

      await tx.update(quotationPlans)
        .set({ status: nextStatus, currentApprovalStage: nextStage, updatedBy: userId, updatedAt: new Date() })
        .where(eq(quotationPlans.id, id));

      if (nextStatus === 3) {
        await this.handleFinalApproval(tx, qp, userId);
      }

      return { success: true };
    });
  }

  static async cancel(id: string, userId: string) {
    return await db.transaction(async (tx) => {
      const qp = await tx.query.quotationPlans.findFirst({
        where: and(eq(quotationPlans.id, id), sql`${quotationPlans.deletedAt} IS NULL`),
      });

      if (!qp) throw new NotFoundError("Quotation Plan not found");

      if (qp.status !== 1 && qp.status !== 2) {
        throw new Error("Only pending Quotation Plans can be cancelled");
      }

      await tx.update(quotationPlans)
        .set({ status: 5, updatedBy: userId, updatedAt: new Date() })
        .where(eq(quotationPlans.id, id));

      return { success: true };
    });
  }

  private static async handleFinalApproval(tx: any, qp: any, userId: string) {
    // 1. Group details by vendorId
    const vendorMap = new Map<string, any[]>();
    for (const d of qp.details) {
      if (!vendorMap.has(d.vendorId)) {
        vendorMap.set(d.vendorId, []);
      }
      vendorMap.get(d.vendorId)!.push(d);
    }

    const orderDate = new Date().toISOString().slice(0, 10);

    for (const [vendorId, items] of vendorMap.entries()) {
      // 2. Generate PO Draft
      const grandTotal = items.reduce((acc: number, d: any) => acc + Number(d.totalPrice), 0);
      
      const [po] = await tx.insert(purchaseOrders).values({
        quotationPlanId: qp.id,
        warehouseId: qp.warehouseId,
        vendorId: vendorId,
        code: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 10000)}`,
        orderDate: orderDate,
        status: 0, // Draft
        currentApprovalStage: 0,
        totalPrice: grandTotal.toString(),
        grandTotal: grandTotal.toString(),
        description: `Generated from Quotation Plan: ${qp.code}`,
        createdBy: userId,
      }).returning();

      // We need to link PO to multiple PRs. 
      // Let's fetch the PRs associated with this QP.
      const qpPrs = await tx.query.quotationPlanPurchaseRequests.findMany({
        where: eq(quotationPlanPurchaseRequests.quotationPlanId, qp.id)
      });
      
      const prIds = qpPrs.map((p: any) => p.purchaseRequestId);

      if (prIds.length > 0) {
        await tx.insert(purchaseOrderRequests).values(
          prIds.map((prId: any) => ({
            purchaseOrderId: po.id,
            purchaseRequestId: prId,
          }))
        );
      }

      // PO Details
      const poDetails = items.map((d: any) => ({
        purchaseOrderId: po.id,
        purchaseRequestDetailId: d.purchaseRequestDetailId,
        quotationPlanDetailId: d.id,
        itemId: d.itemId,
        quantity: d.offeredQuantity, // PO quantity is offered quantity
        price: d.price,
        totalPrice: d.totalPrice,
        remark: d.remark,
        attachmentUrl: d.attachmentUrl,
        createdBy: userId,
      }));

      await tx.insert(purchaseOrderDetails).values(poDetails);

      // 3. Price Histories
      const priceHistoryValues = items.map((d: any) => ({
        itemId: d.itemId,
        vendorId: vendorId,
        price: d.price,
        sourceType: "QUOTATION",
        sourceId: d.id,
        effectiveDate: orderDate,
        createdBy: userId,
      }));

      await tx.insert(itemPriceHistories).values(priceHistoryValues);
    }

    // 4. Update PR Details Processed Quantity
    for (const d of qp.details) {
      await tx.execute(
        sql`UPDATE purchase_request_details SET processed_quantity = processed_quantity + ${d.offeredQuantity} WHERE id = ${d.purchaseRequestDetailId}`
      );
    }

    // 5. Check if all items in PR are fulfilled
    // Get unique PR IDs connected to this QP
    const qpPrs = await tx.query.quotationPlanPurchaseRequests.findMany({
      where: eq(quotationPlanPurchaseRequests.quotationPlanId, qp.id)
    });
    
    for (const prPivot of qpPrs) {
      const prId = prPivot.purchaseRequestId;
      const prDetails = await tx.query.purchaseRequestDetails.findMany({
        where: eq(purchaseRequestDetails.purchaseRequestId, prId)
      });

      const isFullyFulfilled = prDetails.length > 0 && prDetails.every((d: any) => d.processedQuantity >= d.quantity);

      if (isFullyFulfilled) {
        // Status 5 is Complete (as requested by user)
        await tx.update(purchaseRequests)
          .set({ status: 5, updatedAt: new Date(), updatedBy: userId }) 
          .where(eq(purchaseRequests.id, prId));
      }
    }
  }
}
