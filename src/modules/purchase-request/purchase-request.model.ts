import { and, asc, count, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { purchaseRequests, purchaseRequestDetails, purchaseRequestApprovals } from "./purchase-request.schema";
import { toPurchaseRequestDTO, type PurchaseRequestDTO } from "./purchase-request.dto";
import type { PurchaseRequestRecord } from "./purchase-request.schema";
import { roles, userWarehouseRoles, userWarehouseMappings } from "../role/role.schema";
import { users } from "../user/user.schema";
import { transactions, transactionItems } from "../transaction/transaction.schema";
import { inventoryStocks } from "../inventory/inventory.schema";

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

function buildFilterCondition(params: {
  filterColumn?: string;
  searchTerm?: string;
  status?: number;
  warehouseId?: string;
  customerId?: string;
  requestedByUserId?: string;
  visibleWarehouseIds?: string[];
}) {
  const { filterColumn, searchTerm, status, warehouseId, customerId, requestedByUserId, visibleWarehouseIds } = params;
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
  // Role-based visibility: staff can only see their own PRs
  if (requestedByUserId) {
    conds = and(conds, eq(purchaseRequests.requestedBy, requestedByUserId))!;
  }
  // Role-based visibility: WH Head / Branch Head / Manager see only their mapped warehouses
  if (visibleWarehouseIds && visibleWarehouseIds.length > 0) {
    conds = and(conds, inArray(purchaseRequests.warehouseId, visibleWarehouseIds))!;
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
    requestedByUserId?: string;
    visibleWarehouseIds?: string[];
  }): Promise<PurchaseRequestDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, status, warehouseId, customerId, requestedByUserId, visibleWarehouseIds } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition({ filterColumn, searchTerm, status, warehouseId, customerId, requestedByUserId, visibleWarehouseIds });
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
        details: {
          where: isNull(purchaseRequestDetails.deletedAt)
        },
        approvals: {
          with: {
            approver: true,
          }
        }
      }
    });

    return result.map(toPurchaseRequestDTO);
  }

  static async countAll(params: { searchTerm?: string; filterColumn?: string; status?: number; warehouseId?: string; customerId?: string; requestedByUserId?: string; visibleWarehouseIds?: string[] }): Promise<number> {
    const whereClause = buildFilterCondition(params);
    const result = await db.select({ total: count() }).from(purchaseRequests).where(whereClause as any);
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
        approvals: {
          with: {
            approver: true,
          }
        },
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
    details: { itemId: string; quantity: number; price: number; remark?: string; attachmentUrl?: string }[];
  }, userId: string): Promise<PurchaseRequestDTO | undefined> {
    // Validate approvers
    const approvers = await this.getApprovers(payload.warehouseId);
    if (!approvers.warehouseHeads.length || !approvers.branchHeads.length) {
      throw new Error("Gudang tujuan belum memiliki Kepala Gudang atau Kepala Cabang untuk proses persetujuan.");
    }

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
        createdBy: userId,
        updatedBy: userId,
      }).returning();
      
      if (!pr) throw new Error("Failed to insert PR header");

      const detailsToInsert = payload.details.map(d => ({
        purchaseRequestId: pr.id,
        itemId: d.itemId,
        quantity: d.quantity,
        price: d.price.toString(),
        totalPrice: (d.quantity * d.price).toString(),
        remark: d.remark,
        attachmentUrl: d.attachmentUrl,
        createdBy: userId,
        updatedBy: userId,
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
      details?: { itemId: string; quantity: number; price: number; remark?: string; attachmentUrl?: string }[];
    },
    userId?: string
  ): Promise<PurchaseRequestDTO | undefined> {
    const result = await db.transaction(async (tx) => {
      // 1. Update Header
      const headerPayload: any = { 
        updatedAt: new Date(),
        updatedBy: userId,
      };
      if (payload.customerId !== undefined) headerPayload.customerId = payload.customerId;
      if (payload.warehouseId !== undefined) headerPayload.warehouseId = payload.warehouseId;
      if (payload.description !== undefined) headerPayload.description = payload.description;
      
      // Check status first
      const existingPR = await tx.query.purchaseRequests.findFirst({
        where: and(eq(purchaseRequests.id, id), isNull(purchaseRequests.deletedAt))
      });
      if (!existingPR) throw new Error("Purchase request not found");
      if (existingPR.status !== 0) throw new Error("Hanya Purchase Request berstatus Draft yang dapat diubah.");

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
          remark: d.remark,
          attachmentUrl: d.attachmentUrl,
          createdBy: userId,
          updatedBy: userId,
        }));
        await tx.insert(purchaseRequestDetails).values(detailsToInsert);
      }
      
      return pr;
    });
    
    return await this.findById(result.id);
  }

  /**
   * Automatically creates an inbound transaction record + items and upserts inventory_stocks
   * when a Purchase Request is fully approved. Called inside an existing db.transaction (tx).
   */
  private static async autoProcessApprovedPR(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    prId: string,
    prCode: string,
    warehouseId: string,
    userId: string
  ): Promise<void> {
    // 1. Fetch PR details (items)
    const prDetails = await tx
      .select({ itemId: purchaseRequestDetails.itemId, quantity: purchaseRequestDetails.quantity })
      .from(purchaseRequestDetails)
      .where(and(eq(purchaseRequestDetails.purchaseRequestId, prId), isNull(purchaseRequestDetails.deletedAt)));

    if (prDetails.length === 0) return;

    // 2. Create inbound transaction header
    const [txRecord] = await tx.insert(transactions).values({
      warehouseId,
      type: "IN",
      referenceNumber: prCode,
      description: `Stok masuk otomatis dari Purchase Request: ${prCode}`,
      transactionDate: new Date(),
      status: "COMPLETED",
      createdBy: userId,
      updatedBy: userId,
    }).returning({ id: transactions.id });

    if (!txRecord) throw new Error("Gagal membuat record transaksi inbound dari PR.");

    // 3. Insert transaction items
    await tx.insert(transactionItems).values(
      prDetails.map((d) => ({
        transactionId: txRecord.id,
        itemId: d.itemId,
        quantity: d.quantity.toString(),
        createdBy: userId,
        updatedBy: userId,
      }))
    );

    // 4. Upsert inventory_stocks for each item
    for (const detail of prDetails) {
      const existing = await tx
        .select({ id: inventoryStocks.id, quantity: inventoryStocks.quantity })
        .from(inventoryStocks)
        .where(and(eq(inventoryStocks.warehouseId, warehouseId), eq(inventoryStocks.itemId, detail.itemId)));

      if (existing.length === 0) {
        // Insert new stock record
        await tx.insert(inventoryStocks).values({
          warehouseId,
          itemId: detail.itemId,
          quantity: detail.quantity.toString(),
          createdBy: userId,
          updatedBy: userId,
        });
      } else {
        // Update existing stock quantity
        const existingStock = existing[0]!;
        const newQty = Number(existingStock.quantity) + Number(detail.quantity);
        await tx
          .update(inventoryStocks)
          .set({ quantity: newQty.toString(), updatedAt: new Date(), updatedBy: userId })
          .where(eq(inventoryStocks.id, existingStock.id));
      }
    }
  }

  static async patchStatus(
    id: string,
    payload: { status: number; remark?: string },
    userId: string
  ): Promise<PurchaseRequestDTO | undefined> {
    const result = await db.transaction(async (tx) => {
      const pr = await tx.query.purchaseRequests.findFirst({
        where: and(eq(purchaseRequests.id, id), isNull(purchaseRequests.deletedAt)),
      });
      if (!pr) throw new Error("Purchase request not found");

      // Fetch user roles
      const userRoleRecords = await tx
        .select({
          roleName: roles.code,
          warehouseId: userWarehouseRoles.warehouseId,
        })
        .from(userWarehouseRoles)
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(and(eq(userWarehouseRoles.userId, userId), isNull(userWarehouseRoles.deletedAt)));

      const isSuperadmin = userRoleRecords.some(r => r.roleName === "superadmin");
      const isManager = userRoleRecords.some(r => r.roleName === "manager");
      const isBranchHead = userRoleRecords.some(r => r.roleName === "branch_head" && (!r.warehouseId || r.warehouseId === pr.warehouseId));
      const isWarehouseHead = userRoleRecords.some(r => r.roleName === "warehouse_head" && (!r.warehouseId || r.warehouseId === pr.warehouseId));

      const { status, remark } = payload;
      let updatePayload: any = {
        updatedAt: new Date(),
        updatedBy: userId,
      };

      // 1. Transition Draft -> Pending (Submit)
      if (pr.status === 0 && status === 1) {
        // Determine start stage and stages to insert based on creator's role.
        const creatorRoleRecords = await tx
          .select({
            roleName: roles.code,
            warehouseId: userWarehouseRoles.warehouseId,
          })
          .from(userWarehouseRoles)
          .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
          .where(and(eq(userWarehouseRoles.userId, pr.requestedBy), isNull(userWarehouseRoles.deletedAt)));

        const creatorIsSuperadmin = creatorRoleRecords.some(r => r.roleName === "superadmin");
        const creatorIsManager = creatorRoleRecords.some(r => r.roleName === "manager");
        const creatorIsBranchHead = creatorRoleRecords.some(r => r.roleName === "branch_head" && (!r.warehouseId || r.warehouseId === pr.warehouseId));
        const creatorIsWarehouseHead = creatorRoleRecords.some(r => r.roleName === "warehouse_head" && (!r.warehouseId || r.warehouseId === pr.warehouseId));

        if (creatorIsSuperadmin || creatorIsManager) {
          updatePayload.status = 2; // Approved
          updatePayload.currentApprovalStage = 3;
          updatePayload.approvedBy = pr.requestedBy;
          updatePayload.approvedAt = new Date();

          // Insert 1 row representing Manager approval
          await tx.insert(purchaseRequestApprovals).values({
            purchaseRequestId: id,
            stage: 2, // Manager
            status: 1, // Approved
            approvedBy: pr.requestedBy,
            approvedAt: new Date(),
            remark: "Auto-Approved by Manager/Superadmin",
            createdBy: userId,
            updatedBy: userId,
          });
        } else {
          updatePayload.status = 1; // Pending
          const stagesToInsert: number[] = [];

          if (creatorIsBranchHead) {
            updatePayload.currentApprovalStage = 2; // Waiting for Manager
            stagesToInsert.push(2);
          } else if (creatorIsWarehouseHead) {
            updatePayload.currentApprovalStage = 1; // Waiting for Branch Head
            stagesToInsert.push(1, 2);
          } else {
            updatePayload.currentApprovalStage = 0; // Waiting for Warehouse Head
            stagesToInsert.push(0, 1, 2);
          }

          // Insert pending approvals
          const approvalValues = stagesToInsert.map(stage => ({
            purchaseRequestId: id,
            stage,
            status: 0, // Pending
            createdBy: userId,
            updatedBy: userId,
          }));
          await tx.insert(purchaseRequestApprovals).values(approvalValues);
        }
      } 
      // 2. Approving or Rejecting when Pending (1)
      else if (pr.status === 1) {
        if (status === 3) {
          // Rejecting: Must be the active stage approver or Superadmin
          let canReject = isSuperadmin;
          if (pr.currentApprovalStage === 0 && isWarehouseHead) canReject = true;
          if (pr.currentApprovalStage === 1 && isBranchHead) canReject = true;
          if (pr.currentApprovalStage === 2 && isManager) canReject = true;

          if (!canReject) throw new Error("You are not authorized to reject this purchase request at the current stage");

          // Update active stage approval record to Rejected (2)
          await tx
            .update(purchaseRequestApprovals)
            .set({
              status: 2, // Rejected
              approvedBy: userId,
              approvedAt: new Date(),
              remark: remark || null,
              updatedAt: new Date(),
              updatedBy: userId,
            })
            .where(
              and(
                eq(purchaseRequestApprovals.purchaseRequestId, id),
                eq(purchaseRequestApprovals.stage, pr.currentApprovalStage)
              )
            );

          updatePayload.status = 3; // Rejected
          updatePayload.approvedBy = userId;
          updatePayload.approvedAt = new Date();
        } else if (status === 2 || status === 1) {
          // Approving
          // Check for Superadmin Bypass
          if (isSuperadmin && status === 2) {
            updatePayload.status = 2; // Approved
            updatePayload.currentApprovalStage = 3;
            updatePayload.approvedBy = userId;
            updatePayload.approvedAt = new Date();

            // Set all pending approval steps to Approved
            await tx
              .update(purchaseRequestApprovals)
              .set({
                status: 1, // Approved
                approvedBy: userId,
                approvedAt: new Date(),
                remark: remark || "Bypassed by Superadmin",
                updatedAt: new Date(),
                updatedBy: userId,
              })
              .where(
                and(
                  eq(purchaseRequestApprovals.purchaseRequestId, id),
                  eq(purchaseRequestApprovals.status, 0)
                )
              );

            // Auto-process approved PR: create inbound transaction + upsert inventory
            await PurchaseRequestModel.autoProcessApprovedPR(tx, id, pr.code, pr.warehouseId, userId);
          } else {
            // Regular approval flow
            if (pr.currentApprovalStage === 0) {
              if (!isWarehouseHead) throw new Error("Only the assigned Warehouse Head can approve at this stage");
            } else if (pr.currentApprovalStage === 1) {
              if (!isBranchHead) throw new Error("Only the assigned Branch Head can approve at this stage");
            } else if (pr.currentApprovalStage === 2) {
              if (!isManager) throw new Error("Only a Manager can approve at this stage");
            } else {
              throw new Error("This purchase request is already approved or fully processed");
            }

            // Update the current approval step to Approved
            await tx
              .update(purchaseRequestApprovals)
              .set({
                status: 1, // Approved
                approvedBy: userId,
                approvedAt: new Date(),
                remark: remark || null,
                updatedAt: new Date(),
                updatedBy: userId,
              })
              .where(
                and(
                  eq(purchaseRequestApprovals.purchaseRequestId, id),
                  eq(purchaseRequestApprovals.stage, pr.currentApprovalStage)
                )
              );

            // Determine if there are more pending stages
            const nextPending = await tx.query.purchaseRequestApprovals.findFirst({
              where: and(
                eq(purchaseRequestApprovals.purchaseRequestId, id),
                eq(purchaseRequestApprovals.status, 0), // Pending
                isNull(purchaseRequestApprovals.deletedAt)
              ),
              orderBy: asc(purchaseRequestApprovals.stage),
            });

            if (nextPending) {
              updatePayload.currentApprovalStage = nextPending.stage;
              updatePayload.status = 1; // Keep Pending
            } else {
              updatePayload.currentApprovalStage = 3; // Finished
              updatePayload.status = 2; // Approved
              updatePayload.approvedBy = userId;
              updatePayload.approvedAt = new Date();

              // Auto-process approved PR: create inbound transaction + upsert inventory
              await PurchaseRequestModel.autoProcessApprovedPR(tx, id, pr.code, pr.warehouseId, userId);
            }
          }
        } else {
          throw new Error("Invalid status transition for pending purchase request");
        }
      } else {
        throw new Error(`Cannot change status of purchase request with current status: ${pr.status}`);
      }

      await tx
        .update(purchaseRequests)
        .set(updatePayload)
        .where(eq(purchaseRequests.id, id));

      return id;
    });

    return await this.findById(result);
  }

  static async softDelete(id: string): Promise<boolean> {
    const existingPR = await db.query.purchaseRequests.findFirst({
      where: and(eq(purchaseRequests.id, id), isNull(purchaseRequests.deletedAt))
    });
    if (!existingPR) return false;
    if (existingPR.status !== 0) throw new Error("Hanya Purchase Request berstatus Draft yang dapat dihapus.");

    const result = await db
      .update(purchaseRequests)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(purchaseRequests.id, id), isNull(purchaseRequests.deletedAt)))
      .returning({ id: purchaseRequests.id });
    return result.length > 0;
  }

  static async getApprovers(warehouseId: string) {
    const specificRolesData = await db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        roleCode: roles.code
      })
      .from(userWarehouseRoles)
      .innerJoin(users, eq(userWarehouseRoles.userId, users.id))
      .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
      .where(
        and(
          isNull(userWarehouseRoles.deletedAt),
          isNull(users.deletedAt)
        )
      );
    
    // Filter in memory for simplicity
    const managers = specificRolesData.filter(r => r.roleCode === "manager");
    
    const warehouseData = await db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        roleCode: roles.code
      })
      .from(userWarehouseRoles)
      .innerJoin(users, eq(userWarehouseRoles.userId, users.id))
      .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
      .innerJoin(userWarehouseMappings, eq(userWarehouseMappings.userId, users.id))
      .where(
        and(
          eq(userWarehouseMappings.warehouseId, warehouseId),
          eq(userWarehouseMappings.isActive, true),
          isNull(userWarehouseMappings.deletedAt),
          isNull(userWarehouseRoles.deletedAt),
          isNull(users.deletedAt)
        )
      );

    const warehouseHeads = warehouseData.filter(r => r.roleCode === "warehouse_head");
    const branchHeads = warehouseData.filter(r => r.roleCode === "branch_head");

    // Remove duplicates
    const uniqueManagers = Array.from(new Map(managers.map(item => [item.userId, item])).values());
    const uniqueWHHeads = Array.from(new Map(warehouseHeads.map(item => [item.userId, item])).values());
    const uniqueBranchHeads = Array.from(new Map(branchHeads.map(item => [item.userId, item])).values());

    return {
      warehouseHeads: uniqueWHHeads,
      branchHeads: uniqueBranchHeads,
      managers: uniqueManagers
    };
  }
}
