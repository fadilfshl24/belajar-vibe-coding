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

      const { page, limit, orderBy, searchTerm, filterColumn, isActive, excludeHasHead } = parsed.data;
      const internalLimit = limit === 1000 ? Number.MAX_SAFE_INTEGER : limit;

      const [totalRecord, records] = await Promise.all([
        WarehouseModel.countAll({ searchTerm, filterColumn, isActive, excludeHasHead }),
        WarehouseModel.findAll({ page, limit: internalLimit, orderBy, searchTerm, filterColumn, isActive, excludeHasHead }),
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

/**
 * WarehouseRegionController
 *
 * Endpoint untuk mendukung fitur filter wilayah pada Branch Head mapping.
 * Mengembalikan data distinct dari kolom province & city_regency di tabel warehouses.
 */
export class WarehouseRegionController {
  /**
   * GET /api/warehouses/regions
   * Mengembalikan daftar provinsi unik dari gudang yang aktif.
   */
  static async getProvinces(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const { db } = await import("../../core/db");
      const { warehouses: warehousesTable } = await import("./warehouse.schema");
      const { provinces: provincesTable } = await import("../region/region.schema");
      const { isNull, eq } = await import("drizzle-orm");

      const rows = await db
        .selectDistinct({ id: warehousesTable.province, name: provincesTable.name })
        .from(warehousesTable)
        .leftJoin(provincesTable, eq(warehousesTable.province, provincesTable.id))
        .where(
          // Use SQL directly since and() requires specific type
          isNull(warehousesTable.deletedAt)
        );

      // Filter active and non-null province in JS for safety
      const provinces = rows
        .filter(r => r.id !== null && r.id !== "")
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      return successResponse(correlationId, "Data found!", { provinces });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  /**
   * GET /api/warehouse-regions/cities?province=X
   * Mengembalikan daftar kota/kabupaten unik di provinsi tertentu.
   */
  static async getCitiesByProvince(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const { province, excludeHasBranchHead } = ctx.query as { province?: string, excludeHasBranchHead?: string };
      if (!province) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "province query param is required", 400);
      }

      const { db } = await import("../../core/db");
      const { warehouses: warehousesTable } = await import("./warehouse.schema");
      const { regencies: regenciesTable } = await import("../region/region.schema");
      const { and, isNull, eq, notInArray } = await import("drizzle-orm");
      const { userWarehouseMappings, userWarehouseRoles, roles } = await import("../role/role.schema");

      let conds = and(
        isNull(warehousesTable.deletedAt),
        eq(warehousesTable.isActive, true),
        eq(warehousesTable.province, province)
      );

      if (excludeHasBranchHead === 'true') {
        const branchHeadSubquery = db
          .select({ cityId: warehousesTable.cityRegency })
          .from(userWarehouseMappings)
          .innerJoin(warehousesTable, eq(userWarehouseMappings.warehouseId, warehousesTable.id))
          .innerJoin(userWarehouseRoles, eq(userWarehouseMappings.userId, userWarehouseRoles.userId))
          .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
          .where(eq(roles.code, 'branch_head'));

        conds = and(conds, notInArray(warehousesTable.cityRegency, branchHeadSubquery))!;
      }

      const rows = await db
        .selectDistinct({ id: warehousesTable.cityRegency, name: regenciesTable.name })
        .from(warehousesTable)
        .leftJoin(regenciesTable, eq(warehousesTable.cityRegency, regenciesTable.id))
        .where(conds);

      const cities = rows
        .filter(r => r.id !== null && r.id !== "")
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      return successResponse(correlationId, "Data found!", { cities });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  /**
   * GET /api/warehouses/by-region?province=X&city=Y
   * Mengembalikan daftar gudang aktif di wilayah tertentu.
   */
  static async getByRegion(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const { province, city } = ctx.query as { province?: string; city?: string };

      if (!province || !city) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "province and city query params are required", 400);
      }

      const { db } = await import("../../core/db");
      const { warehouses: warehousesTable } = await import("./warehouse.schema");
      const { and, isNull, eq } = await import("drizzle-orm");

      const records = await db
        .select({
          id: warehousesTable.id,
          code: warehousesTable.code,
          name: warehousesTable.name,
          province: warehousesTable.province,
          cityRegency: warehousesTable.cityRegency,
        })
        .from(warehousesTable)
        .where(
          and(
            isNull(warehousesTable.deletedAt),
            eq(warehousesTable.isActive, true),
            eq(warehousesTable.province, province),
            eq(warehousesTable.cityRegency, city)
          )
        )
        .orderBy(warehousesTable.code);

      return successResponse(correlationId, "Data found!", { records });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
