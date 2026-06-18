import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { ItemModel } from "./item.model";
import { parseCreateItemInput, parseUpdateItemInput, parseItemListQuery } from "./item.validation";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ORDER_BY = "{'CreatedAt':'DESC'}";

export class ItemController {
  // ---------------------------------------------------------------------------
  // GET /api/items
  // ---------------------------------------------------------------------------
  static async getAll(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const parsed = parseItemListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query params", 400, parsed.error.issues[0]?.message);
      }

      const { page, limit, orderBy, searchTerm, filterColumn, itemType } = parsed.data;
      const internalLimit = limit === 1000 ? Number.MAX_SAFE_INTEGER : limit;

      const [totalRecord, records] = await Promise.all([
        ItemModel.countAll(searchTerm, filterColumn, itemType),
        ItemModel.findAll({ page, limit: internalLimit, orderBy, searchTerm, filterColumn, itemType }),
      ]);

      const totalPage = limit === 1000 ? 1 : Math.ceil(totalRecord / limit);
      const baseUrl = (process.env.APP_URL ?? "http://localhost:3000") + "/api/items";
      const buildUrl = (p: number) => {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(limit),
          ...(filterColumn ? { filterColumn } : {}),
          ...(searchTerm ? { searchTerm } : {}),
          ...(itemType ? { itemType } : {}),
          ...(orderBy !== DEFAULT_ORDER_BY ? { orderBy } : {}),
        });
        return `${baseUrl}?${params.toString()}`;
      };

      const pagination: PaginationMeta = {
        page,
        limit,
        totalRecord,
        totalPage,
        nextPage: page < totalPage,
        previousPage: page > 1,
        nextPageURL: page < totalPage ? buildUrl(page + 1) : "",
        previousPageURL: page > 1 ? buildUrl(page - 1) : "",
        filterColumn: filterColumn ?? "",
        searchTerm: searchTerm ?? "",
        orderBy,
      };

      return successResponse(correlationId, "Data found!", { records }, pagination);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  // ---------------------------------------------------------------------------
  // GET /api/items/:id
  // ---------------------------------------------------------------------------
  static async getById(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400, "Invalid UUID format");
      }
      const item = await ItemModel.findById(id);
      if (!item) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }
      return successResponse(correlationId, "Data found!", { record: item });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  // ---------------------------------------------------------------------------
  // POST /api/items
  // ---------------------------------------------------------------------------
  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const parsed = parseCreateItemInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, parsed.error.issues[0]?.message ?? "Input invalid!");
      }

      const existing = await ItemModel.findByCode(parsed.data.code);
      if (existing) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, "Item code already exists");
      }

      const item = await ItemModel.create(parsed.data);

      await logActivity({
        userId: ctx.user?.sub,
        action: "CREATE_DATA",
        description: `User ${ctx.user?.email} menambahkan data Item "${item.name}" (${item.itemType}) dengan ID ${item.id}`,
      });

      return successResponse(correlationId, "Data has been created", { record: item });
    } catch (err: unknown) {
      ctx.set.status = 400;
      const msg = err instanceof Error ? err.message : "Unknown error";
      const code = msg.includes("not found") || msg.includes("must be") ? 400 : 500;
      ctx.set.status = code;
      return failedResponse(correlationId, code === 400 ? "Create data failed!" : "Internal server error", code as 400 | 500, msg);
    }
  }

  // ---------------------------------------------------------------------------
  // PUT /api/items/:id
  // ---------------------------------------------------------------------------
  static async update(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Update data failed!", 400, "Invalid UUID format");
      }

      const parsed = parseUpdateItemInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Update data failed!", 400, parsed.error.issues[0]?.message ?? "Input invalid!");
      }

      const existing = await ItemModel.findById(id);
      if (!existing) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }

      if (parsed.data.code) {
        const codeExists = await ItemModel.findByCode(parsed.data.code);
        if (codeExists && codeExists.id !== id) {
          ctx.set.status = 400;
          return failedResponse(correlationId, "Update data failed!", 400, "Item code already exists");
        }
      }

      const updated = await ItemModel.update(id, parsed.data);

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_DATA",
        description: `User ${ctx.user?.email} mengubah data Item ID ${id}`,
      });

      return successResponse(correlationId, "Data has been updated", { record: updated });
    } catch (err: unknown) {
      ctx.set.status = 400;
      const msg = err instanceof Error ? err.message : "Unknown error";
      const code = msg.includes("not found") || msg.includes("must be") ? 400 : 500;
      ctx.set.status = code;
      return failedResponse(correlationId, code === 400 ? "Update data failed!" : "Internal server error", code as 400 | 500, msg);
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE /api/items/:id
  // ---------------------------------------------------------------------------
  static async remove(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Delete data failed!", 400, "Invalid UUID format");
      }

      const existing = await ItemModel.findById(id);
      if (!existing) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }

      await ItemModel.softDelete(id);

      await logActivity({
        userId: ctx.user?.sub,
        action: "DELETE_DATA",
        description: `User ${ctx.user?.email} menghapus data Item ID ${id}`,
      });

      return successResponse(correlationId, "Data has been deleted", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}