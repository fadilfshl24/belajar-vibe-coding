import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { TransactionModel } from "./transaction.model";
import { TransactionService } from "./transaction.service";
import { parseCreateTransaction, parseCancelRequest, parseCancelApprove, parseListQuery } from "./transaction.validation";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { logActivity } from "../../core/utils/activityLogger";
import { db } from "../../core/db";
import { userWarehouseMappings, userWarehouseRoles, roles } from "../role/role.schema";
import { eq, and, isNull } from "drizzle-orm";

export class TransactionController {
  static async getAll(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const parsed = parseListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query params", 400, parsed.error.issues[0]?.message);
      }

      const { page, limit, searchTerm, warehouseId, type, status } = parsed.data;
      const userId = ctx.user?.sub;
      let userWarehouseIds: string[] | undefined = undefined;

      if (userId) {
        const userRoleRows = await db
          .select({ roleCode: roles.code })
          .from(userWarehouseRoles)
          .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
          .where(and(isNull(userWarehouseRoles.deletedAt), eq(userWarehouseRoles.userId, userId)));

        const roleCodes = [...new Set(userRoleRows.map((r) => r.roleCode))];
        const isGlobalViewer = roleCodes.some((r) => ["superadmin", "admin", "manager"].includes(r));
        const isRestrictedByWarehouse = roleCodes.some((r) => ["warehouse_head", "branch_head"].includes(r));

        if (!isGlobalViewer && isRestrictedByWarehouse) {
          const mappings = await db
            .select({ warehouseId: userWarehouseMappings.warehouseId })
            .from(userWarehouseMappings)
            .where(
              and(
                eq(userWarehouseMappings.userId, userId),
                eq(userWarehouseMappings.isActive, true),
                isNull(userWarehouseMappings.deletedAt)
              )
            );
          userWarehouseIds = mappings.map((m) => m.warehouseId);
          if (userWarehouseIds.length === 0) {
            return successResponse(correlationId, "Success", [], {
              page,
              limit,
              totalRecord: 0,
              totalPage: 0,
              nextPage: false,
              previousPage: false,
              nextPageURL: "",
              previousPageURL: "",
              filterColumn: "",
              searchTerm: searchTerm ?? "",
              orderBy: "",
            });
          }
        }
      }

      const [totalRecord, records] = await Promise.all([
        TransactionModel.countAll({ searchTerm, warehouseId, type, status, userWarehouseIds }),
        TransactionModel.findAll({ page, limit, searchTerm, warehouseId, type, status, userWarehouseIds }),
      ]);

      const totalPage = Math.ceil(totalRecord / limit);

      const pagination: PaginationMeta = {
        page,
        limit,
        totalRecord,
        totalPage,
        nextPage: page < totalPage,
        previousPage: page > 1,
        nextPageURL: "",
        previousPageURL: "",
        filterColumn: "",
        searchTerm: searchTerm ?? "",
        orderBy: "",
      };

      return successResponse(correlationId, "Data found!", { records }, pagination);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async getById(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      const tx = await TransactionModel.findById(id);
      if (!tx) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }
      return successResponse(correlationId, "Data found!", { record: tx });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const parsed = parseCreateTransaction(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, parsed.error.issues[0]?.message);
      }

      const { items, ...txData } = parsed.data;
      
      const created = await TransactionModel.create(
        {
          ...txData,
          transactionDate: txData.transactionDate ? new Date(txData.transactionDate) : new Date(),
          createdBy: ctx.user!.sub,
        },
        items.map(i => ({ itemId: i.itemId, quantity: i.quantity.toString() })),
        ctx.user?.sub
      );

      await logActivity({
        userId: ctx.user?.sub,
        action: "CREATE_DATA",
        description: `User ${ctx.user?.email} membuat transaksi ${txData.type} baru (${txData.referenceNumber})`,
      });

      return successResponse(correlationId, "Transaction created", { record: created });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Create data failed!", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async complete(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";

      // Check if caller is superadmin to bypass stock lock
      const userRoles: string[] = (ctx.user as any)?.roles ?? [];
      const isSuperadmin = userRoles.includes("superadmin");

      await TransactionService.completeTransaction(id, ctx.user?.sub, isSuperadmin);

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_DATA",
        description: `User ${ctx.user?.email} menyelesaikan transaksi ID ${id}`,
      });

      return successResponse(correlationId, "Transaction completed successfully", null);
    } catch (err: unknown) {
      ctx.set.status = 400;
      return failedResponse(correlationId, "Complete transaction failed!", 400, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async cancelRequest(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      const parsed = parseCancelRequest(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Cancel request failed!", 400, parsed.error.issues[0]?.message);
      }

      const txData = await TransactionModel.findById(id);
      if (!txData) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }
      if (txData.status !== "COMPLETED" && txData.status !== "DRAFT") {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Cancel request failed!", 400, "Can only cancel COMPLETED or DRAFT transactions");
      }

      // if DRAFT, just cancel directly
      if (txData.status === "DRAFT") {
        await TransactionModel.updateStatus(id, "CANCELLED", ctx.user?.sub);
        return successResponse(correlationId, "Transaction cancelled", null);
      }

      const approval = await TransactionModel.requestCancel({
        transactionId: id,
        remark: parsed.data.remark,
        requestedBy: ctx.user!.sub,
      }, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_DATA",
        description: `User ${ctx.user?.email} merequest pembatalan transaksi ID ${id}`,
      });

      return successResponse(correlationId, "Cancel request submitted", { record: approval });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Cancel request failed!", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async cancelApprove(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? ""; // transactionId
      const parsed = parseCancelApprove(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Approve failed!", 400, parsed.error.issues[0]?.message);
      }

      const approval = await TransactionModel.getPendingApprovalByTransaction(id);
      if (!approval) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "No pending cancel request found", 400);
      }

      await TransactionService.approveCancellation(
        approval.id,
        ctx.user!.sub,
        parsed.data.status,
        parsed.data.responseRemark
      );

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_DATA",
        description: `User ${ctx.user?.email} melakukan ${parsed.data.status} pada request batal transaksi ID ${id}`,
      });

      return successResponse(correlationId, "Approval processed", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Approve failed!", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
