import type { Context } from "elysia";
import { AssemblyOrderModel } from "./assembly-order.model";
import { AssemblyOrderService } from "./assembly-order.service";
import {
  parseCreateAssemblyOrderInput,
  parseAssemblyOrderListQuery,
} from "./assembly-order.validation";
import { failedResponse, successResponse } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { logActivity } from "../../core/utils/activityLogger";
import { db } from "../../core/db";
import { userWarehouseMappings, userWarehouseRoles, roles } from "../role/role.schema";
import { eq, and, isNull } from "drizzle-orm";

const MODULE_TYPE = "ASSEMBLY_ORDER";

export class AssemblyOrderController {
  static async getAll(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseAssemblyOrderListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query parameters", 400, parsed.error.issues[0]?.message);
      }

      const params = parsed.data;
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
        const isRestrictedByWarehouse = roleCodes.some((r) => ["warehouse_head", "branch_head", "staff"].includes(r));

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
              page: params.page,
              limit: params.limit,
              totalRecord: 0,
              totalPage: 0,
              nextPage: false,
              previousPage: false,
              nextPageURL: "",
              previousPageURL: "",
              filterColumn: "",
              searchTerm: "",
              orderBy: "",
            });
          }
        } else if (!isGlobalViewer && !isRestrictedByWarehouse) {
          return successResponse(correlationId, "Success", [], {
            page: params.page,
            limit: params.limit,
            totalRecord: 0,
            totalPage: 0,
            nextPage: false,
            previousPage: false,
            nextPageURL: "",
            previousPageURL: "",
            filterColumn: "",
            searchTerm: "",
            orderBy: "",
          });
        }
      }

      const rows = await AssemblyOrderModel.findAll({
        ...params,
        warehouseIds: visibleWarehouseIds,
      });
      const totalCount = await AssemblyOrderModel.countAll({
        ...params,
        warehouseIds: visibleWarehouseIds,
      });

      const totalPage = Math.ceil(totalCount / params.limit) || 1;

      return successResponse(correlationId, "Success", rows, {
        page: params.page,
        limit: params.limit,
        totalRecord: totalCount,
        totalPage,
        nextPage: params.page < totalPage,
        previousPage: params.page > 1,
        nextPageURL: "",
        previousPageURL: "",
        filterColumn: params.filterColumn || "",
        searchTerm: params.searchTerm || "",
        orderBy: params.orderBy,
      });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async getById(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id || "";
      const record = await AssemblyOrderModel.findById(id);

      if (!record) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Data not found", 404);
      }

      return successResponse(correlationId, "Success", { record });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const userId = ctx.user?.sub;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const parsed = parseCreateAssemblyOrderInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid input parameters", 400, parsed.error.issues[0]?.message);
      }

      const record = await AssemblyOrderService.create(parsed.data, userId);

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "CREATE_DATA",
        description: `User ${ctx.user?.email} membuat pengajuan perakitan (Assembly Order) dengan ID ${record.id} dan kode ${record.code}`,
      });

      return successResponse(correlationId, "Assembly Order created successfully", { record });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async approve(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const userId = ctx.user?.sub;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const id = (ctx.params as Record<string, string>).id || "";
      const record = await AssemblyOrderService.approve(id, userId);

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "APPROVE_DATA",
        description: `User ${ctx.user?.email} menyetujui Assembly Order ID ${id} dan kode ${record.code}`,
      });

      return successResponse(correlationId, "Assembly Order approved successfully", { record });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async reject(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const userId = ctx.user?.sub;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const id = (ctx.params as Record<string, string>).id || "";
      const record = await AssemblyOrderService.reject(id, userId);

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "REJECT_DATA",
        description: `User ${ctx.user?.email} menolak Assembly Order ID ${id} dan kode ${record.code}`,
      });

      return successResponse(correlationId, "Assembly Order rejected successfully", { record });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
