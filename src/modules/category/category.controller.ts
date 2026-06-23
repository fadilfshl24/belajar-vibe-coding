import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { CategoryModel } from "./category.model";
import { parseCreateCategoryInput, parseUpdateCategoryInput, parseCategoryListQuery } from "./category.validation";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ORDER_BY = "{'CreatedAt':'DESC'}";

export class CategoryController {
  static async getAll(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const parsed = parseCategoryListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query params", 400, parsed.error.issues[0]?.message);
      }

      const { page, limit, orderBy, searchTerm, filterColumn, isActive } = parsed.data;
      const internalLimit = limit === 1000 ? Number.MAX_SAFE_INTEGER : limit;

      const [totalRecord, records] = await Promise.all([
        CategoryModel.countAll({ searchTerm, filterColumn, isActive }),
        CategoryModel.findAll({ page, limit: internalLimit, orderBy, searchTerm, filterColumn, isActive }),
      ]);

      const totalPage = limit === 1000 ? 1 : Math.ceil(totalRecord / limit);
      const baseUrl = (process.env.APP_URL ?? "http://localhost:3000") + "/api/categories";
      const buildUrl = (p: number) => {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(limit),
          ...(filterColumn ? { filterColumn } : {}),
          ...(searchTerm ? { searchTerm } : {}),
          ...(isActive !== undefined ? { isActive: String(isActive) } : {}),
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

  static async getById(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400, "Invalid UUID format");
      }
      const category = await CategoryModel.findById(id);
      if (!category) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }
      return successResponse(correlationId, "Data found!", { record: category });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const parsed = parseCreateCategoryInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, parsed.error.issues[0]?.message ?? "Input invalid!");
      }

      const existing = await CategoryModel.findByCode(parsed.data.code);
      if (existing) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, "Category code already exists");
      }

      const category = await CategoryModel.create(parsed.data);

      await logActivity({
        userId: ctx.user?.sub,
        action: "CREATE_DATA",
        description: `User ${ctx.user?.email} menambahkan data Category "${category.name}" dengan ID ${category.id}`,
      });

      return successResponse(correlationId, "Data has been created", { record: category });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async update(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Update data failed!", 400, "Invalid UUID format");
      }

      const parsed = parseUpdateCategoryInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Update data failed!", 400, parsed.error.issues[0]?.message ?? "Input invalid!");
      }

      const existing = await CategoryModel.findById(id);
      if (!existing) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }

      if (parsed.data.code) {
        const codeExists = await CategoryModel.findByCode(parsed.data.code);
        if (codeExists && codeExists.id !== id) {
          ctx.set.status = 400;
          return failedResponse(correlationId, "Update data failed!", 400, "Category code already exists");
        }
      }

      const updated = await CategoryModel.update(id, parsed.data);

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_DATA",
        description: `User ${ctx.user?.email} mengubah data Category ID ${id}`,
      });

      return successResponse(correlationId, "Data has been updated", { record: updated });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async remove(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Delete data failed!", 400, "Invalid UUID format");
      }

      const existing = await CategoryModel.findById(id);
      if (!existing) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }

      await CategoryModel.softDelete(id);

      await logActivity({
        userId: ctx.user?.sub,
        action: "DELETE_DATA",
        description: `User ${ctx.user?.email} menghapus data Category ID ${id}`,
      });

      return successResponse(correlationId, "Data has been deleted", null);
    } catch (err: unknown) {
      ctx.set.status = 400;
      return failedResponse(correlationId, "Delete data failed!", 400, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
