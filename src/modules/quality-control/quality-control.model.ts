import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import { db } from "../../core/db";
import { qualityControls, qualityControlDetails, qualityControlApprovals } from "./quality-control.schema";
import { goodsReceipts, goodsReceiptDetails } from "../goods-receipt/goods-receipt.schema";
import { inventoryStocks } from "../inventory/inventory.schema";
import { transactions, transactionItems } from "../transaction/transaction.schema";
import { approvalSteps } from "../approval-step/approval-step.schema";
import { users } from "../user/user.schema";
import { userWarehouseMappings, userWarehouseRoles, roles } from "../role/role.schema";
import { CreateQualityControlInput } from "./quality-control.validation";

async function generateQCCode(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const prefix = `QC-${dateStr}-`;

  const lastQC = await db.query.qualityControls.findFirst({
    where: (qc, { ilike }) => ilike(qc.code, `${prefix}%`),
    orderBy: [desc(qualityControls.code)],
  });

  let nextNum = 1;
  if (lastQC && lastQC.code) {
    const lastNumStr = lastQC.code.replace(prefix, "");
    const lastNum = parseInt(lastNumStr, 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  const paddedNum = nextNum.toString().padStart(4, "0");
  return `${prefix}${paddedNum}`;
}

export class QualityControlModel {
  static async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    filterColumn?: string;
    status?: number;
  }, userId?: string) {
    const { page, limit, status } = params;
    const offset = (page - 1) * limit;

    const conditions = [isNull(qualityControls.deletedAt)];

    // Filtering based on user's warehouse mapping
    if (userId) {
      // Check if user is superadmin
      const userRolesResult = await db.select({ roleCode: roles.code })
        .from(userWarehouseRoles)
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(eq(userWarehouseRoles.userId, userId));

      const isSuperAdmin = userRolesResult.some(r => r.roleCode === 'superadmin');

      if (!isSuperAdmin) {
        // Find allowed warehouses
        const allowedWarehousesResult = await db.select({ warehouseId: userWarehouseMappings.warehouseId })
          .from(userWarehouseMappings)
          .where(
            and(
              eq(userWarehouseMappings.userId, userId),
              eq(userWarehouseMappings.isActive, true),
              isNull(userWarehouseMappings.deletedAt)
            )
          );

        const allowedWarehouseIds = allowedWarehousesResult.map(w => w.warehouseId).filter(Boolean) as string[];

        if (allowedWarehouseIds.length === 0) {
          return { data: [], total: 0, page, limit, totalPages: 0 };
        } else {
          // Find GRs belonging to allowed warehouses
          const allowedGRsResult = await db.select({ id: goodsReceipts.id })
            .from(goodsReceipts)
            .where(inArray(goodsReceipts.warehouseId, allowedWarehouseIds));

          const allowedGRIds = allowedGRsResult.map(gr => gr.id);

          if (allowedGRIds.length === 0) {
            return { data: [], total: 0, page, limit, totalPages: 0 };
          } else {
            conditions.push(inArray(qualityControls.goodsReceiptId, allowedGRIds));
          }
        }
      }
    }
    if (status !== undefined) conditions.push(eq(qualityControls.status, status));

    const whereClause = and(...conditions);

    const [data, totalCount] = await Promise.all([
      db.query.qualityControls.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: [desc(qualityControls.createdAt)],
        with: {
          goodsReceipt: true,
          inspector: true,
        },
      }),
      db.$count(qualityControls, whereClause),
    ]);

    return {
      data,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  static async findById(id: string) {
    return await db.query.qualityControls.findFirst({
      where: and(eq(qualityControls.id, id), isNull(qualityControls.deletedAt)),
      with: {
        goodsReceipt: {
          with: { warehouse: true }
        },
        inspector: true,
        details: {
          where: isNull(qualityControlDetails.deletedAt),
          with: { item: true }
        },
        approvals: {
          where: isNull(qualityControlApprovals.deletedAt),
          with: { approver: true }
        }
      }
    });
  }

  static async create(payload: CreateQualityControlInput, userId: string) {
    return await db.transaction(async (tx) => {
      // 1. Verify GR exists and is in Pending QC status
      const gr = await tx.query.goodsReceipts.findFirst({
        where: and(eq(goodsReceipts.id, payload.goodsReceiptId), isNull(goodsReceipts.deletedAt))
      });
      if (!gr) throw new Error("Goods Receipt not found");
      if (gr.status !== 1) throw new Error(`Goods Receipt is not pending QC. Current status: ${gr.status}`);

      // 2. Validate details
      const grDetailIds = payload.details.map((d) => d.goodsReceiptDetailId);
      const existingGrDetails = await tx.query.goodsReceiptDetails.findMany({
        where: and(
          inArray(goodsReceiptDetails.id, grDetailIds),
          eq(goodsReceiptDetails.goodsReceiptId, payload.goodsReceiptId)
        )
      });

      if (existingGrDetails.length !== payload.details.length) {
        throw new Error("Some Goods Receipt Details are invalid or do not belong to this GR");
      }

      const code = await generateQCCode();

      // 3. Insert QC Header
      const [qc] = await tx.insert(qualityControls).values({
        code,
        goodsReceiptId: payload.goodsReceiptId,
        inspectionDate: payload.inspectionDate,
        status: 1, // Auto set to Pending Approval
        currentApprovalStage: 0,
        inspectorId: userId,
        notes: payload.notes,
        createdBy: userId,
        updatedBy: userId,
      }).returning();

      if (!qc) throw new Error("Failed to create QC header");

      // 4. Insert QC Details
      const qcDetailsToInsert = payload.details.map(d => ({
        qualityControlId: qc.id,
        goodsReceiptDetailId: d.goodsReceiptDetailId,
        itemId: d.itemId,
        passQuantity: d.passQuantity,
        rejectQuantity: d.rejectQuantity,
        rejectReason: d.rejectReason,
        createdBy: userId,
        updatedBy: userId,
      }));

      await tx.insert(qualityControlDetails).values(qcDetailsToInsert);

      return qc;
    });
  }

  static async approve(qcId: string, userId: string, remark?: string) {
    return await db.transaction(async (tx) => {
      const qc = await tx.query.qualityControls.findFirst({
        where: and(eq(qualityControls.id, qcId), isNull(qualityControls.deletedAt)),
        with: {
          goodsReceipt: true,
          details: true
        }
      });

      if (!qc) throw new Error("Quality Control not found");
      if (qc.status !== 1) throw new Error("Quality Control is not in pending approval state");

      const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user) throw new Error("User not found");

      // Fetch user roles
      const userRoleRecords = await tx
        .select({
          roleId: roles.id,
          roleCode: roles.code,
          warehouseId: userWarehouseRoles.warehouseId,
        })
        .from(userWarehouseRoles)
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(and(eq(userWarehouseRoles.userId, userId), isNull(userWarehouseRoles.deletedAt)));

      // Get approval steps
      const steps = await tx.query.approvalSteps.findMany({
        where: and(
          eq(approvalSteps.documentType, "QC"),
          eq(approvalSteps.isActive, true),
          isNull(approvalSteps.deletedAt)
        ),
        orderBy: (steps, { asc }) => [asc(steps.stage)],
      });

      if (steps.length === 0) {
        throw new Error("Approval steps for QC not configured");
      }

      const currentStageDef = steps.find(s => s.stage === qc.currentApprovalStage);
      if (!currentStageDef) {
        throw new Error("Current approval stage definition not found");
      }

      const isSuperadmin = userRoleRecords.some(r => r.roleCode === "superadmin");

      const hasRequiredRole = userRoleRecords.some(r =>
        r.roleId === currentStageDef.roleId &&
        (!r.warehouseId || r.warehouseId === qc.goodsReceipt?.warehouseId)
      );

      if (!isSuperadmin && !hasRequiredRole) {
        throw new Error("You do not have the required role to approve this stage");
      }

      // Record approval
      await tx.insert(qualityControlApprovals).values({
        qualityControlId: qc.id,
        stage: qc.currentApprovalStage,
        status: 1, // Approved
        approvedBy: userId,
        approvedAt: new Date(),
        remark: remark || "Approved",
        createdBy: userId,
        updatedBy: userId,
      });

      const isLastStage = qc.currentApprovalStage >= Math.max(...steps.map(s => s.stage));

      if (isLastStage) {
        // Final Approval - Update Status to Approved
        await tx.update(qualityControls)
          .set({ status: 2, updatedAt: new Date(), updatedBy: userId })
          .where(eq(qualityControls.id, qc.id));

        // Update GR status
        await tx.update(goodsReceipts)
          .set({ status: 2, updatedAt: new Date(), updatedBy: userId }) // 2: QC Completed
          .where(eq(goodsReceipts.id, qc.goodsReceiptId));

        // Auto Update Inventory & Log Transactions
        const warehouseId = qc.goodsReceipt.warehouseId;

        // Create Transaction IN for Pass
        const passDetails = qc.details.filter(d => d.passQuantity > 0);
        if (passDetails.length > 0) {
          const [trxIn] = await tx.insert(transactions).values({
            warehouseId,
            type: "IN",
            referenceNumber: `TRX-IN-${qc.code}`,
            description: `Auto-stock IN from QC: ${qc.code}`,
            status: "COMPLETED",
            createdBy: userId,
            updatedBy: userId,
          }).returning();

          const trxInItems = passDetails.map(d => ({
            transactionId: trxIn.id,
            itemId: d.itemId,
            quantity: d.passQuantity.toString(),
            createdBy: userId,
            updatedBy: userId,
          }));
          await tx.insert(transactionItems).values(trxInItems);

          // Update real inventory stock
          for (const detail of passDetails) {
            const stock = await tx.query.inventoryStocks.findFirst({
              where: and(eq(inventoryStocks.warehouseId, warehouseId), eq(inventoryStocks.itemId, detail.itemId))
            });

            if (stock) {
              await tx.update(inventoryStocks)
                .set({
                  quantity: (parseFloat(stock.quantity) + detail.passQuantity).toString(),
                  updatedAt: new Date(),
                  updatedBy: userId
                })
                .where(eq(inventoryStocks.id, stock.id));
            } else {
              await tx.insert(inventoryStocks).values({
                warehouseId,
                itemId: detail.itemId,
                quantity: detail.passQuantity.toString(),
                createdBy: userId,
                updatedBy: userId,
              });
            }
          }
        }

        // Create Transaction REJECT for Reject Audit Log (Doesn't add stock)
        const rejectDetails = qc.details.filter(d => d.rejectQuantity > 0);
        if (rejectDetails.length > 0) {
          const [trxReject] = await tx.insert(transactions).values({
            warehouseId,
            type: "REJECT",
            referenceNumber: `TRX-REJ-${qc.code}`,
            description: `Auto-logged REJECT from QC: ${qc.code}`,
            status: "COMPLETED",
            createdBy: userId,
            updatedBy: userId,
          }).returning();

          const trxRejectItems = rejectDetails.map(d => ({
            transactionId: trxReject.id,
            itemId: d.itemId,
            quantity: d.rejectQuantity.toString(),
            createdBy: userId,
            updatedBy: userId,
          }));
          await tx.insert(transactionItems).values(trxRejectItems);
        }

      } else {
        // Move to next stage
        await tx.update(qualityControls)
          .set({ currentApprovalStage: qc.currentApprovalStage + 1, updatedAt: new Date(), updatedBy: userId })
          .where(eq(qualityControls.id, qc.id));
      }

      return await this.findById(qc.id);
    });
  }

  static async reject(qcId: string, userId: string, remark: string) {
    return await db.transaction(async (tx) => {
      const qc = await tx.query.qualityControls.findFirst({
        where: and(eq(qualityControls.id, qcId), isNull(qualityControls.deletedAt)),
        with: {
          goodsReceipt: true
        }
      });

      if (!qc) throw new Error("Quality Control not found");
      if (qc.status !== 1) throw new Error("Quality Control is not in pending approval state");

      const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user) throw new Error("User not found");

      // Fetch user roles
      const userRoleRecords = await tx
        .select({
          roleId: roles.id,
          roleCode: roles.code,
          warehouseId: userWarehouseRoles.warehouseId,
        })
        .from(userWarehouseRoles)
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(and(eq(userWarehouseRoles.userId, userId), isNull(userWarehouseRoles.deletedAt)));

      // Verify role for current stage
      const steps = await tx.query.approvalSteps.findMany({
        where: and(eq(approvalSteps.documentType, "QC"), eq(approvalSteps.isActive, true), isNull(approvalSteps.deletedAt)),
      });
      const currentStageDef = steps.find(s => s.stage === qc.currentApprovalStage);
      if (currentStageDef) {
        const isSuperadmin = userRoleRecords.some(r => r.roleCode === "superadmin");

        const hasRequiredRole = userRoleRecords.some(r =>
          r.roleId === currentStageDef.roleId &&
          (!r.warehouseId || r.warehouseId === qc.goodsReceipt?.warehouseId)
        );

        if (!isSuperadmin && !hasRequiredRole) {
          throw new Error("You do not have the required role to reject this stage");
        }
      }

      await tx.insert(qualityControlApprovals).values({
        qualityControlId: qc.id,
        stage: qc.currentApprovalStage,
        status: 2, // Rejected
        approvedBy: userId,
        approvedAt: new Date(),
        remark: remark,
        createdBy: userId,
        updatedBy: userId,
      });

      await tx.update(qualityControls)
        .set({ status: 3, updatedAt: new Date(), updatedBy: userId }) // 3: Rejected
        .where(eq(qualityControls.id, qc.id));

      return await this.findById(qc.id);
    });
  }
}
