import type { Context } from "elysia";
import { PlatformModel } from "./platform.model";
import {
  parseCreatePlatformInput,
  parseUpdatePlatformInput,
  parsePlatformListQuery,
  type CreatePlatformInput,
  type UpdatePlatformInput,
} from "./platform.validation";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";

export class PlatformController {
  static async getAll(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parsePlatformListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query parameters", 400, parsed.error.issues[0]?.message);
      }

      const params = parsed.data;
      const [totalRecord, records] = await Promise.all([
        PlatformModel.countAll(params),
        PlatformModel.findAll(params),
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
      const id = (ctx.params as Record<string, string>).id;
      const platform = await PlatformModel.findById(id);
      if (!platform) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Platform not found", 404);
      }
      return successResponse(correlationId, "Data found!", { record: platform });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCreatePlatformInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const existing = await PlatformModel.findByCode(parsed.data.code);
      if (existing) {
        ctx.set.status = 409;
        return failedResponse(correlationId, "Platform code already exists", 409);
      }

      const newPlatform = await PlatformModel.create(parsed.data as CreatePlatformInput);
      
      ctx.set.status = 201;
      return successResponse(correlationId, "Platform created successfully", { record: newPlatform });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to create platform", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async update(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id;
      const parsed = parseUpdatePlatformInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      if (parsed.data.code) {
        const existing = await PlatformModel.findByCode(parsed.data.code);
        if (existing && existing.id !== id) {
          ctx.set.status = 409;
          return failedResponse(correlationId, "Platform code already in use", 409);
        }
      }

      const updated = await PlatformModel.update(id, parsed.data as UpdatePlatformInput);
      if (!updated) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Platform not found", 404);
      }

      return successResponse(correlationId, "Platform updated successfully", { record: updated });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to update platform", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async delete(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id;
      const deleted = await PlatformModel.softDelete(id);
      if (!deleted) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Platform not found or already deleted", 404);
      }
      return successResponse(correlationId, "Platform deleted successfully", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to delete platform", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
