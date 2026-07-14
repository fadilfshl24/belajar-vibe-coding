import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { InventoryModel } from "./inventory.model";
import { db } from "../../core/db";
import { userWarehouseMappings, userWarehouseRoles, roles } from "../role/role.schema";
import { eq, and, isNull } from "drizzle-orm";
import type { JwtPayload } from "../../core/types/JwtPayload";

export class InventoryController {
  static async getAll(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const page = parseInt((ctx.query.page as string) ?? "1", 10);
      const limit = parseInt((ctx.query.limit as string) ?? "10", 10);
      const searchTerm = (ctx.query.searchTerm as string | undefined) || undefined;
      const warehouseId = (ctx.query.warehouseId as string | undefined) || undefined;
      const itemId = (ctx.query.itemId as string | undefined) || undefined;

      const userId = ctx.user?.sub;
      let visibleWarehouseIds: string[] | undefined = undefined;

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
          visibleWarehouseIds = mappings.map((m) => m.warehouseId);
          if (visibleWarehouseIds.length === 0) {
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
        } else if (!isGlobalViewer && !isRestrictedByWarehouse) {
          // If neither global viewer nor restricted (e.g. staff without warehouse mappings)
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

      const [totalRecord, records] = await Promise.all([
        InventoryModel.countAll({ searchTerm, warehouseId, itemId, warehouseIds: visibleWarehouseIds }),
        InventoryModel.findAll({ page, limit, searchTerm, warehouseId, itemId, warehouseIds: visibleWarehouseIds }),
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
}
