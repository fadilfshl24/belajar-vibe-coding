import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { RoleModel } from "./role.model";
import { parseCreateRoleInput, parseUpdateRoleInput } from "./role.validation";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ORDER_BY = "{'CreatedAt':'DESC'}";
const MODULE_TYPE = 'ROLE'

export class RoleController {
  // ---------------------------------------------------------------------------
  // GET /api/roles
  // ---------------------------------------------------------------------------
  static async getAll(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const query = ctx.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
      const rawLimit = parseInt(query.limit ?? "10", 10) || 10;
      const internalLimit = rawLimit === 1000 ? Number.MAX_SAFE_INTEGER : rawLimit;
      const filterColumn = query.filterColumn ?? "";
      const searchTerm = query.searchTerm ?? "";
      const orderBy = query.orderBy ?? DEFAULT_ORDER_BY;

      const [totalRecord, records] = await Promise.all([
        RoleModel.countAll(searchTerm || undefined, filterColumn || undefined),
        RoleModel.findAll({ page, limit: internalLimit, orderBy, searchTerm: searchTerm || undefined, filterColumn: filterColumn || undefined }),
      ]);

      const totalPage = rawLimit === 1000 ? 1 : Math.ceil(totalRecord / rawLimit);
      const baseUrl = (process.env.APP_URL ?? "http://localhost:3000") + "/api/roles";
      const buildUrl = (p: number) => {
        const params = new URLSearchParams({ page: String(p), limit: String(rawLimit), ...(filterColumn ? { filterColumn } : {}), ...(searchTerm ? { searchTerm } : {}), ...(orderBy !== DEFAULT_ORDER_BY ? { orderBy } : {}) });
        return `${baseUrl}?${params.toString()}`;
      };

      const pagination: PaginationMeta = {
        page, limit: rawLimit, totalRecord, totalPage,
        nextPage: page < totalPage,
        previousPage: page > 1,
        nextPageURL: page < totalPage ? buildUrl(page + 1) : "",
        previousPageURL: page > 1 ? buildUrl(page - 1) : "",
        filterColumn, searchTerm, orderBy,
      };

      return successResponse(correlationId, "Data found!", { records }, pagination);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // GET /api/roles/:id
  // ---------------------------------------------------------------------------
  static async getById(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        return failedResponse(correlationId, "Data not found!", 400, "Invalid UUID format");
      }

      const role = await RoleModel.findById(id);
      if (!role) return failedResponse(correlationId, "Data not found!", 400);

      return successResponse(correlationId, "Data found!", { record: role });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // POST /api/roles
  // ---------------------------------------------------------------------------
  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCreateRoleInput(ctx.body);
      if (!parsed.success) {
        return failedResponse(
          correlationId,
          "Create data failed!",
          400,
          parsed.error.issues[0]?.message ?? "Input invalid!"
        );
      }

      const existing = await RoleModel.findByCode(parsed.data.code);
      if (existing) {
        return failedResponse(correlationId, "Create data failed!", 400, "Role code already exists");
      }

      const role = await RoleModel.createRole(parsed.data, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "CREATE_DATA",
        description: `User ${ctx.user?.email} menambahkan data Role dengan ID ${role.id}`,
      });

      return successResponse(correlationId, "Data has been created", { record: role });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // PUT /api/roles/:id
  // ---------------------------------------------------------------------------
  static async update(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        return failedResponse(correlationId, "Update data failed!", 400, "Invalid UUID format");
      }

      const parsed = parseUpdateRoleInput(ctx.body);
      if (!parsed.success) {
        return failedResponse(
          correlationId,
          "Update data failed!",
          400,
          parsed.error.issues[0]?.message ?? "Input invalid!"
        );
      }

      const existing = await RoleModel.findById(id);
      if (!existing) return failedResponse(correlationId, "Data not found!", 400);

      const updated = await RoleModel.updateRole(id, parsed.data, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "UPDATE_DATA",
        description: `User ${ctx.user?.email} mengubah data Role ID ${id}`,
      });

      return successResponse(correlationId, "Data has been updated", { record: updated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE /api/roles/:id
  // ---------------------------------------------------------------------------
  static async remove(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        return failedResponse(correlationId, "Delete data failed!", 400, "Invalid UUID format");
      }

      const existing = await RoleModel.findById(id);
      if (!existing) return failedResponse(correlationId, "Data not found!", 400);

      await RoleModel.softDelete(id);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "DELETE_DATA",
        description: `User ${ctx.user?.email} menghapus data Role ID ${id}`,
      });

      return successResponse(correlationId, "Data has been deleted", null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }
}
