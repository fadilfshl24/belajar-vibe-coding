import type { Context } from "elysia";
import { QuotationPlanModel } from "./quotation-plan.model";
import {
  parseCreateQPInput,
  parseApprovalQPInput,
  parseQPListQuery,
} from "./quotation-plan.validation";
import { failedResponse, successResponse } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { logActivity } from "../../core/utils/activityLogger";
import { toQuotationPlanDTO } from "./quotation-plan.dto";
import { db } from "../../core/db";
import { userWarehouseMappings, userWarehouseRoles, roles } from "../role/role.schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveRequiredApprovalStage } from "../../core/utils/approval-stage.resolver";

export class QuotationPlanController {
  static async getAll(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseQPListQuery(ctx.query);
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
        requiredApprovalStage = await resolveRequiredApprovalStage(userId, "QP");
      }

      // ⚡ Bolt: Execute findAll and countAll concurrently to reduce overall latency
      const [rows, totalCount] = await Promise.all([
        QuotationPlanModel.findAll({
          ...params,
          warehouseIds: visibleWarehouseIds,
          requiredApprovalStage,
        }),
        QuotationPlanModel.countAll({
          ...params,
          warehouseIds: visibleWarehouseIds,
          requiredApprovalStage,
        })
      ]);

      return successResponse(correlationId, "Success", rows.map(toQuotationPlanDTO), {
        page: params.page,
        limit: params.limit,
        totalRecord: totalCount,
        totalPage: Math.ceil(totalCount / params.limit),
        nextPage: params.page < Math.ceil(totalCount / params.limit),
        previousPage: params.page > 1,
        nextPageURL: "",
        previousPageURL: "",
        filterColumn: "",
        searchTerm: "",
        orderBy: "",
      });
    } catch (error: any) {
      console.error(error);
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, error.message);
    }
  }

  static async getById(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = ctx.params.id;
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
          visibleWarehouseIds = mappings.map((m) => m.warehouseId as string).filter(Boolean);
          if (visibleWarehouseIds.length === 0) {
             ctx.set.status = 403;
             return failedResponse(correlationId, "Forbidden", 403);
          }
        } else if (!isGlobalViewer && !isRestrictedByWarehouse) {
             ctx.set.status = 403;
             return failedResponse(correlationId, "Forbidden", 403);
        }
      }

      const qp = await QuotationPlanModel.findById(id, visibleWarehouseIds);
      return successResponse(correlationId, "Success", toQuotationPlanDTO(qp));
    } catch (error: any) {
      const statusCode = (error.statusCode as 400 | 401 | 403 | 404 | 409 | 500) || 500;
      ctx.set.status = statusCode;
      return failedResponse(correlationId, error.message || "Internal server error", statusCode, error.message);
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCreateQPInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const result = await QuotationPlanModel.create(parsed.data, ctx.user!.sub);

      await logActivity({
        userId: ctx.user!.sub,
        action: "CREATE",
        module: "QUOTATION_PLAN",
        description: `Created Quotation Plan ${result.code}`,
      });

      return successResponse(correlationId, "Created successfully", toQuotationPlanDTO(result));
    } catch (error: any) {
      const statusCode = (error.statusCode as 400 | 401 | 403 | 404 | 409 | 500) || 500;
      ctx.set.status = statusCode;
      return failedResponse(correlationId, error.message || "Internal server error", statusCode, error.message);
    }
  }

  static async approve(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseApprovalQPInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const id = ctx.params.id;
      const userId = ctx.user!.sub;

      const userRoleRows = await db
        .select({ roleCode: roles.code })
        .from(userWarehouseRoles)
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(and(isNull(userWarehouseRoles.deletedAt), eq(userWarehouseRoles.userId, userId)));

      const roleCodes = [...new Set(userRoleRows.map((r) => r.roleCode))];
      let stage = -1;
      if (roleCodes.includes("branch_head")) stage = 1;
      else if (roleCodes.includes("warehouse_head")) stage = 0;

      if (stage === -1) {
        ctx.set.status = 403;
        return failedResponse(correlationId, "Unauthorized role for approval", 403);
      }

      await QuotationPlanModel.approve(id, stage, parsed.data, userId);

      await logActivity({
        userId: userId,
        action: "APPROVE",
        module: "QUOTATION_PLAN",
        description: `${parsed.data.status === 1 ? 'Approved' : 'Rejected'} Quotation Plan ${id} at stage ${stage}`,
      });

      return successResponse(correlationId, "Status updated successfully", null);
    } catch (error: any) {
      const statusCode = (error.statusCode as 400 | 401 | 403 | 404 | 409 | 500) || 500;
      ctx.set.status = statusCode;
      return failedResponse(correlationId, error.message || "Internal server error", statusCode, error.message);
    }
  }
}
