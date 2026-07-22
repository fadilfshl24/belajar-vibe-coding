import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { ApprovalStepModel } from "./approval-step.model";
import { parseCreateApprovalStepInput, parseUpdateApprovalStepInput } from "./approval-step.validation";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODULE_TYPE = 'APPROVAL_STEP'

export class ApprovalStepController {
  static async getAll(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const query = ctx.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
      const rawLimit = parseInt(query.limit ?? "10", 10) || 10;
      const internalLimit = rawLimit === 1000 ? Number.MAX_SAFE_INTEGER : rawLimit;
      const documentType = query.documentType;

      const [totalRecord, records] = await Promise.all([
        ApprovalStepModel.countAll(documentType),
        ApprovalStepModel.findAll({ page, limit: internalLimit, documentType }),
      ]);

      const totalPage = rawLimit === 1000 ? 1 : Math.ceil(totalRecord / rawLimit);
      const baseUrl = (process.env.APP_URL ?? "http://localhost:3000") + "/api/approval-steps";
      const buildUrl = (p: number) => {
        const params = new URLSearchParams({ page: String(p), limit: String(rawLimit), ...(documentType ? { documentType } : {}) });
        return `${baseUrl}?${params.toString()}`;
      };

      const pagination: PaginationMeta = {
        page, limit: rawLimit, totalRecord, totalPage,
        nextPage: page < totalPage,
        previousPage: page > 1,
        nextPageURL: page < totalPage ? buildUrl(page + 1) : "",
        previousPageURL: page > 1 ? buildUrl(page - 1) : "",
        filterColumn: "",
        searchTerm: "",
        orderBy: "",
      };

      return successResponse(correlationId, "Data found!", { records }, pagination);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  static async getById(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        return failedResponse(correlationId, "Data not found!", 400, "Invalid UUID format");
      }

      const record = await ApprovalStepModel.findById(id);
      if (!record) return failedResponse(correlationId, "Data not found!", 400);

      return successResponse(correlationId, "Data found!", { record });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCreateApprovalStepInput(ctx.body);
      if (!parsed.success) {
        return failedResponse(correlationId, "Create data failed!", 400, parsed.error.issues[0]?.message ?? "Input invalid!");
      }

      const existing = await ApprovalStepModel.findByDocumentAndStage(parsed.data.documentType, parsed.data.stage);
      if (existing) {
        return failedResponse(correlationId, "Create data failed!", 400, "Approval stage already exists for this document type");
      }

      const record = await ApprovalStepModel.create(parsed.data, ctx.user?.sub);

      if (!record) {
        return failedResponse(correlationId, "Create data failed!", 500, "Failed to create approval step");
      }

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "CREATE_DATA",
        description: `User ${ctx.user?.email} menambahkan data Approval Step dengan ID ${record.id}`,
      });

      return successResponse(correlationId, "Data has been created", { record });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  static async update(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        return failedResponse(correlationId, "Update data failed!", 400, "Invalid UUID format");
      }

      const parsed = parseUpdateApprovalStepInput(ctx.body);
      if (!parsed.success) {
        return failedResponse(correlationId, "Update data failed!", 400, parsed.error.issues[0]?.message ?? "Input invalid!");
      }

      const existing = await ApprovalStepModel.findById(id);
      if (!existing) return failedResponse(correlationId, "Data not found!", 400);

      if (parsed.data.stage !== undefined && parsed.data.documentType !== undefined) {
         if (parsed.data.stage !== existing.stage || parsed.data.documentType !== existing.documentType) {
           const stageConflict = await ApprovalStepModel.findByDocumentAndStage(parsed.data.documentType, parsed.data.stage);
           if (stageConflict && stageConflict.id !== id) {
             return failedResponse(correlationId, "Update data failed!", 400, "Approval stage already exists for this document type");
           }
         }
      }

      const updated = await ApprovalStepModel.update(id, parsed.data, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "UPDATE_DATA",
        description: `User ${ctx.user?.email} mengubah data Approval Step ID ${id}`,
      });

      return successResponse(correlationId, "Data has been updated", { record: updated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  static async remove(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        return failedResponse(correlationId, "Delete data failed!", 400, "Invalid UUID format");
      }

      const existing = await ApprovalStepModel.findById(id);
      if (!existing) return failedResponse(correlationId, "Data not found!", 400);

      await ApprovalStepModel.softDelete(id, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "DELETE_DATA",
        description: `User ${ctx.user?.email} menghapus data Approval Step ID ${id}`,
      });

      return successResponse(correlationId, "Data has been deleted", null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  static async getApprovers(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    
    try {
      const query = ctx.query as Record<string, string | undefined>;
      const documentType = query.documentType;
      const warehouseId = query.warehouseId;

      if (!documentType) {
        return failedResponse(correlationId, "documentType is required", 400);
      }

      const approvers = await ApprovalStepModel.getApproversByDocument(documentType, warehouseId);
      return successResponse(correlationId, "Data found!", { records: approvers });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }
}
