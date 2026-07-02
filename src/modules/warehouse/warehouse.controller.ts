import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { WarehouseModel, WarehouseHeadModel } from "./warehouse.model";
import { parseCreateWarehouseInput, parseUpdateWarehouseInput, parseWarehouseListQuery, parseAssignWarehouseHeadInput } from "./warehouse.validation";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ORDER_BY = "{'CreatedAt':'DESC'}";
const MODULE_TYPE = "WAREHOUSE"

export class WarehouseController {
  static async getAll(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const parsed = parseWarehouseListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query params", 400, parsed.error.issues[0]?.message);
      }

      const { page, limit, orderBy, searchTerm, filterColumn, isActive } = parsed.data;
      const internalLimit = limit === 1000 ? Number.MAX_SAFE_INTEGER : limit;

      const [totalRecord, records] = await Promise.all([
        WarehouseModel.countAll({ searchTerm, filterColumn, isActive }),
        WarehouseModel.findAll({ page, limit: internalLimit, orderBy, searchTerm, filterColumn, isActive }),
      ]);

      const totalPage = limit === 1000 ? 1 : Math.ceil(totalRecord / limit);
      const baseUrl = (process.env.APP_URL ?? "http://localhost:3000") + "/api/warehouses";
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
      const warehouse = await WarehouseModel.findById(id);
      if (!warehouse) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }
      return successResponse(correlationId, "Data found!", { record: warehouse });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const parsed = parseCreateWarehouseInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, parsed.error.issues[0]?.message ?? "Input invalid!");
      }

      const existing = await WarehouseModel.findByCode(parsed.data.code);
      if (existing) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, "Warehouse code already exists");
      }

      const warehouse = await WarehouseModel.create(parsed.data, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "CREATE_DATA",
        description: `User ${ctx.user?.email} menambahkan data Warehouse "${warehouse.name}" dengan ID ${warehouse.id}`,
      });

      return successResponse(correlationId, "Data has been created", { record: warehouse });
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

      const parsed = parseUpdateWarehouseInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Update data failed!", 400, parsed.error.issues[0]?.message ?? "Input invalid!");
      }

      const existing = await WarehouseModel.findById(id);
      if (!existing) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }

      if (parsed.data.code) {
        const codeExists = await WarehouseModel.findByCode(parsed.data.code);
        if (codeExists && codeExists.id !== id) {
          ctx.set.status = 400;
          return failedResponse(correlationId, "Update data failed!", 400, "Warehouse code already exists");
        }
      }

      const updated = await WarehouseModel.update(id, parsed.data, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "UPDATE_DATA",
        description: `User ${ctx.user?.email} mengubah data Warehouse ID ${id}`,
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

      const existing = await WarehouseModel.findById(id);
      if (!existing) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }

      await WarehouseModel.softDelete(id);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "DELETE_DATA",
        description: `User ${ctx.user?.email} menghapus data Warehouse ID ${id}`,
      });

      return successResponse(correlationId, "Data has been deleted", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Delete data failed!", 400, err instanceof Error ? err.message : "Unknown error");
    }
  }
}

export class WarehouseHeadController {
  static async getByWarehouse(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const warehouseId = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(warehouseId)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid warehouse UUID", 400);
      }
      const records = await WarehouseHeadModel.findByWarehouse(warehouseId);
      return successResponse(correlationId, "Data found!", { records });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async assign(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const warehouseId = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(warehouseId)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid warehouse UUID", 400);
      }

      const parsed = parseAssignWarehouseHeadInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Assign head failed!", 400, parsed.error.issues[0]?.message);
      }

      const head = await WarehouseHeadModel.assign({
        warehouseId,
        userId: parsed.data.userId,
        description: parsed.data.description,
      });

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "CREATE_DATA",
        description: `User ${ctx.user?.email} menugaskan user ID ${parsed.data.userId} sebagai kepala gudang ID ${warehouseId}`,
      });

      return successResponse(correlationId, "Warehouse head assigned successfully", { record: head });
    } catch (err: unknown) {
      ctx.set.status = 400;
      return failedResponse(correlationId, "Assign head failed!", 400, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async unassign(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const headId = (ctx.params as Record<string, string>).headId ?? "";
      if (!UUID_REGEX.test(headId)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid head UUID", 400);
      }

      await WarehouseHeadModel.softDelete(headId);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "DELETE_DATA",
        description: `User ${ctx.user?.email} melepas tugas kepala gudang ID ${headId}`,
      });

      return successResponse(correlationId, "Warehouse head unassigned successfully", null);
    } catch (err: unknown) {
      ctx.set.status = 400;
      return failedResponse(correlationId, "Unassign head failed!", 400, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
