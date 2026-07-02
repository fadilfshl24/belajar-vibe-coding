import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { MenuModel } from "./menu.model";
import { parseCreateMenuInput, parseUpdateMenuInput } from "./menu.validation";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ORDER_BY = "{'CreatedAt':'DESC'}";
const MODULE_TYPE = "MENU"

export class MenuController {
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
        MenuModel.countAll(searchTerm || undefined, filterColumn || undefined),
        MenuModel.findAll({ page, limit: internalLimit, orderBy, searchTerm: searchTerm || undefined, filterColumn: filterColumn || undefined }),
      ]);

      const totalPage = rawLimit === 1000 ? 1 : Math.ceil(totalRecord / rawLimit);
      const baseUrl = (process.env.APP_URL ?? "http://localhost:3000") + "/api/menus";
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
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async getById(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) return failedResponse(correlationId, "Data not found!", 400, "Invalid UUID format");
      const menu = await MenuModel.findById(id);
      if (!menu) return failedResponse(correlationId, "Data not found!", 400);
      return successResponse(correlationId, "Data found!", { record: menu });
    } catch (err: unknown) {
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const parsed = parseCreateMenuInput(ctx.body);
      if (!parsed.success) return failedResponse(correlationId, "Create data failed!", 400, parsed.error.issues[0]?.message);

      const existing = await MenuModel.findByCode(parsed.data.code);
      if (existing) return failedResponse(correlationId, "Create data failed!", 400, "Menu code already exists");

      const menu = await MenuModel.createMenu(parsed.data, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "CREATE_DATA",
        description: `User ${ctx.user?.email} menambahkan data Menu "${menu.name}" dengan ID ${menu.id}`,
      });

      return successResponse(correlationId, "Data has been created", { record: menu });
    } catch (err: unknown) {
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async update(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) return failedResponse(correlationId, "Update data failed!", 400, "Invalid UUID format");

      const parsed = parseUpdateMenuInput(ctx.body);
      if (!parsed.success) return failedResponse(correlationId, "Update data failed!", 400, parsed.error.issues[0]?.message);

      const existing = await MenuModel.findById(id);
      if (!existing) return failedResponse(correlationId, "Data not found!", 400);

      const updated = await MenuModel.updateMenu(id, parsed.data, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "UPDATE_DATA",
        description: `User ${ctx.user?.email} mengubah data Menu ID ${id}`,
      });

      return successResponse(correlationId, "Data has been updated", { record: updated });
    } catch (err: unknown) {
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async remove(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) return failedResponse(correlationId, "Delete data failed!", 400, "Invalid UUID format");

      const existing = await MenuModel.findById(id);
      if (!existing) return failedResponse(correlationId, "Data not found!", 400);

      await MenuModel.softDelete(id);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "DELETE_DATA",
        description: `User ${ctx.user?.email} menghapus data Menu ID ${id}`,
      });

      return successResponse(correlationId, "Data has been deleted", null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Cannot delete menu because it has active children")) {
        return failedResponse(correlationId, "Delete data failed!", 400, msg);
      }
      return failedResponse(correlationId, "Internal server error", 500, msg);
    }
  }
}
