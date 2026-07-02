import type { Context } from "elysia";
import { PurchaseRequestModel } from "./purchase-request.model";
import {
  parseCreatePRInput,
  parseUpdatePRInput,
  parsePRListQuery,
  parsePatchPRStatus,
  type CreatePRInput,
  type UpdatePRInput,
} from "./purchase-request.validation";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { logActivity } from "../../core/utils/activityLogger";

export class PurchaseRequestController {
  static async getAll(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parsePRListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query parameters", 400, parsed.error.issues[0]?.message);
      }

      const params = parsed.data;
      const [totalRecord, records] = await Promise.all([
        PurchaseRequestModel.countAll(params),
        PurchaseRequestModel.findAll(params),
      ]);

      const totalPage = Math.ceil(totalRecord / params.limit) || 1;

      const pagination: PaginationMeta = {
        page: params.page,
        limit: params.limit,
        totalRecord,
        totalPage,
        nextPage: params.page < totalPage,
        previousPage: params.page > 1,
        nextPageURL: "",
        previousPageURL: "",
        filterColumn: "",
        searchTerm: params.searchTerm ?? "",
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
      const pr = await PurchaseRequestModel.findById(id);
      if (!pr) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Purchase request not found", 404);
      }
      return successResponse(correlationId, "Data found!", { record: pr });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCreatePRInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const userId = ctx.user?.sub;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized user", 401);
      }

      const newPR = await PurchaseRequestModel.create(parsed.data as CreatePRInput, userId);
      if (!newPR) {
        ctx.set.status = 500;
        return failedResponse(correlationId, "Failed to create purchase request", 500);
      }

      await logActivity({
        userId: ctx.user?.sub,
        action: "CREATE_ORDER",
        module: "PURCHASE_REQUEST",
        description: `User ${ctx.user?.email} membuat Purchase Request "${newPR.code}" dengan ID ${newPR.id}`,
      });

      ctx.set.status = 201;
      return successResponse(correlationId, "Purchase request created successfully", { record: newPR });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to create purchase request", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async update(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      const pr = await PurchaseRequestModel.findById(id);
      if (!pr) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Purchase request not found", 404);
      }
      if (pr.status !== 0) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Only draft purchase requests can be updated", 400);
      }

      const parsed = parseUpdatePRInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const updated = await PurchaseRequestModel.update(id, parsed.data as UpdatePRInput, ctx.user?.sub);
      if (!updated) {
        ctx.set.status = 500;
        return failedResponse(correlationId, "Failed to update purchase request", 500);
      }

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_ORDER",
        module: "PURCHASE_REQUEST",
        description: `User ${ctx.user?.email} memperbarui Purchase Request "${updated.code}" dengan ID ${updated.id}`,
      });

      return successResponse(correlationId, "Purchase request updated successfully", { record: updated });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to update purchase request", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async updateStatus(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      const parsed = parsePatchPRStatus(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const pr = await PurchaseRequestModel.findById(id);
      if (!pr) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Purchase request not found", 404);
      }

      const userId = ctx.user?.sub ?? "";
      
      const updated = await PurchaseRequestModel.patchStatus(id, parsed.data, userId);
      if (!updated) {
        ctx.set.status = 500;
        return failedResponse(correlationId, "Failed to update status", 500);
      }

      // Determine action and description for logging
      let action = "UPDATE_ORDER";
      let description = `User ${ctx.user?.email} mengubah status Purchase Request "${updated.code}"`;

      if (pr.status === 0 && updated.status === 1) {
        action = "SUBMIT_PR";
        description = `User ${ctx.user?.email} mengajukan Purchase Request "${updated.code}" untuk diproses approval`;
      } else if (pr.status === 0 && updated.status === 2) {
        action = "BYPASS_PR";
        description = `User ${ctx.user?.email} mengajukan dan otomatis menyetujui Purchase Request "${updated.code}" (Auto-Approved)`;
      } else if (pr.status === 1 && updated.status === 2) {
        if (updated.currentApprovalStage === 3 && pr.currentApprovalStage === 2) {
          action = "APPROVE_PR";
          description = `User ${ctx.user?.email} melakukan approval akhir (Manager) pada Purchase Request "${updated.code}"`;
        } else {
          action = "BYPASS_PR";
          description = `User ${ctx.user?.email} melakukan BYPASS Approval pada Purchase Request "${updated.code}"`;
        }
      } else if (pr.status === 1 && updated.status === 3) {
        action = "REJECT_PR";
        description = `User ${ctx.user?.email} menolak Purchase Request "${updated.code}"${parsed.data.remark ? ` dengan alasan: "${parsed.data.remark}"` : ""}`;
      } else if (pr.status === 1 && updated.status === 1 && (updated.currentApprovalStage ?? 0) > (pr.currentApprovalStage ?? 0)) {
        action = "APPROVE_PR";
        const stageName = pr.currentApprovalStage === 0 ? "Warehouse Head" : "Branch Head";
        description = `User ${ctx.user?.email} menyetujui tingkat ${stageName} pada Purchase Request "${updated.code}"`;
      }

      await logActivity({
        userId: ctx.user?.sub,
        action,
        module: "PURCHASE_REQUEST",
        description,
      });

      return successResponse(correlationId, "Purchase request status updated", { record: updated });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to update status", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async delete(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      const pr = await PurchaseRequestModel.findById(id);
      if (!pr) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Purchase request not found", 404);
      }
      if (pr.status !== 0) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Only draft purchase requests can be deleted", 400);
      }

      const deleted = await PurchaseRequestModel.softDelete(id);

      await logActivity({
        userId: ctx.user?.sub,
        action: "DELETE_ORDER",
        module: "PURCHASE_REQUEST",
        description: `User ${ctx.user?.email} menghapus Purchase Request "${pr.code}"`,
      });

      return successResponse(correlationId, "Purchase request deleted successfully", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to delete purchase request", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
