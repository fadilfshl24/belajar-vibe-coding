import type { Context } from "elysia";
import { ScrapModel } from "./scrap.model";
import {
  parseCreateScrapInput,
  parseScrapListQuery,
  parseApproveScrapInput,
} from "./scrap.validation";
import { failedResponse, successResponse } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { logActivity } from "../../core/utils/activityLogger";
import { db } from "../../core/db";
import { userWarehouseMappings, userWarehouseRoles, roles } from "../role/role.schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveRequiredApprovalStage } from "../../core/utils/approval-stage.resolver";

const MODULE_TYPE = "SCRAP";

export class ScrapController {
  static async getAll(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseScrapListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query parameters", 400, parsed.error.issues[0]?.message);
      }

      const params = parsed.data;
      const userId = ctx.user?.sub;
      let visibleWarehouseIds: string[] | undefined = undefined;
      let requiredApprovalStage: number | undefined = undefined;

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

        // Dynamic approval stage filter based on approval_steps config
        requiredApprovalStage = await resolveRequiredApprovalStage(userId, "SCRAP");
      }

      const rows = await ScrapModel.findAll({
        ...params,
        warehouseIds: visibleWarehouseIds,
        requiredApprovalStage,
      });
      const totalCount = await ScrapModel.countAll({
        ...params,
        warehouseIds: visibleWarehouseIds,
        requiredApprovalStage,
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
      const record = await ScrapModel.findById(id);

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

      const parsed = parseCreateScrapInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid input parameters", 400, parsed.error.issues[0]?.message);
      }

      const record = await ScrapModel.create(parsed.data, userId);

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "CREATE_DATA",
        description: `User ${ctx.user?.email} mengajukan penyesuaian stok (Scrap) dengan ID ${record.id} dan kode ${record.code}`,
      });

      return successResponse(correlationId, "Scrap request created successfully", { record });
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
      const record = await ScrapModel.approve(id, userId);

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "APPROVE_DATA",
        description: `User ${ctx.user?.email} menyetujui pengajuan scrap ID ${id}`,
      });

      return successResponse(correlationId, "Scrap approved successfully", { record });
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
      const record = await ScrapModel.reject(id, userId);

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "REJECT_DATA",
        description: `User ${ctx.user?.email} menolak pengajuan scrap ID ${id}`,
      });

      return successResponse(correlationId, "Scrap rejected successfully", { record });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
