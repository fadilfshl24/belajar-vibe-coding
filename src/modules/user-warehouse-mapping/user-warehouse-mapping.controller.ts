import type { Context } from "elysia";
import { db } from "../../core/db";
import { userWarehouseMappings, userWarehouseRoles, roles } from "../role/role.schema";
import { users } from "../user/user.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { eq, and, isNull, inArray, ne } from "drizzle-orm";
import { warehouseHeads } from "../warehouse/warehouse.schema";
import { UserModel } from "../user/user.model";
import { parseCreateMappingInput, parseGetMappingsQuery } from "./user-warehouse-mapping.validation";
import { failedResponse, successResponse } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { logActivity } from "../../core/utils/activityLogger";

export class UserWarehouseMappingController {
  static async getAll(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseGetMappingsQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query parameters", 400, parsed.error.issues[0]?.message);
      }

      const params = parsed.data;
      let query = db
        .select({
          id: userWarehouseMappings.id,
          userId: userWarehouseMappings.userId,
          warehouseId: userWarehouseMappings.warehouseId,
          userName: users.name,
          userEmail: users.email,
          warehouseCode: warehouses.code,
          warehouseName: warehouses.name,
          isActive: userWarehouseMappings.isActive,
        })
        .from(userWarehouseMappings)
        .innerJoin(users, eq(userWarehouseMappings.userId, users.id))
        .innerJoin(warehouses, eq(userWarehouseMappings.warehouseId, warehouses.id))
        .where(
          and(
            isNull(userWarehouseMappings.deletedAt),
            isNull(users.deletedAt),
            isNull(warehouses.deletedAt)
          )
        );

      if (params.userId) {
        query = query.where(eq(userWarehouseMappings.userId, params.userId));
      }

      const records = await query;

      return successResponse(correlationId, "Data found!", { records });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async createOrUpdate(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCreateMappingInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const { userId, warehouseIds } = parsed.data;

      const user = await UserModel.findById(userId);
      const isWarehouseHead = user?.role?.code === "warehouse_head";
      const isBranchHead = user?.role?.code === "branch_head";

      if (isWarehouseHead && warehouseIds.length > 0) {
        // Validate if any of the target warehouses already have an active head (other than this user)
        const existingHeads = await db
          .select({ warehouseId: warehouseHeads.warehouseId })
          .from(warehouseHeads)
          .where(
            and(
              inArray(warehouseHeads.warehouseId, warehouseIds),
              ne(warehouseHeads.userId, userId),
              isNull(warehouseHeads.deletedAt)
            )
          );
          
        if (existingHeads.length > 0) {
          ctx.set.status = 400;
          return failedResponse(correlationId, "Warehouse already has a head", 400, "One or more selected warehouses already have a warehouse head assigned.");
        }
      }

      if (isBranchHead && warehouseIds.length > 0) {
        // Find cities of the selected warehouses
        const targetCities = await db
          .selectDistinct({ cityId: warehouses.cityRegency })
          .from(warehouses)
          .where(inArray(warehouses.id, warehouseIds));
        
        const cityIds = targetCities.map(c => c.cityId).filter(id => id !== null) as string[];

        if (cityIds.length > 0) {
          // Check if any of these cities already have a branch head assigned to them (other than this user)
          const existingBranchHeads = await db
            .select({ cityId: warehouses.cityRegency })
            .from(userWarehouseMappings)
            .innerJoin(warehouses, eq(userWarehouseMappings.warehouseId, warehouses.id))
            .innerJoin(userWarehouseRoles, eq(userWarehouseMappings.userId, userWarehouseRoles.userId))
            .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
            .where(
              and(
                inArray(warehouses.cityRegency, cityIds),
                eq(roles.code, "branch_head"),
                ne(userWarehouseMappings.userId, userId)
              )
            );
            
          if (existingBranchHeads.length > 0) {
            ctx.set.status = 400;
            return failedResponse(correlationId, "Region already has a branch head", 400, "The selected region already has a branch head assigned.");
          }
        }
      }

      // Hapus mapping lama untuk user ini terlebih dahulu (hard delete untuk pivot)
      await db.delete(userWarehouseMappings).where(eq(userWarehouseMappings.userId, userId));
      
      if (isWarehouseHead) {
        await db.delete(warehouseHeads).where(eq(warehouseHeads.userId, userId));
      }

      // Buat mapping baru
      if (warehouseIds.length > 0) {
        const insertData = warehouseIds.map(warehouseId => ({
          userId,
          warehouseId,
          isActive: true,
          createdBy: ctx.user?.sub,
        }));
        await db.insert(userWarehouseMappings).values(insertData);
        
        if (isWarehouseHead) {
          const headInsertData = warehouseIds.map(warehouseId => ({
            userId,
            warehouseId,
            isActive: true,
            createdBy: ctx.user?.sub,
          }));
          await db.insert(warehouseHeads).values(headInsertData);
        }
      }

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_MAPPING",
        module: "USER_WAREHOUSE_MAPPING",
        description: `User ${ctx.user?.email} memperbarui pemetaan gudang untuk user ID ${userId}`,
      });

      ctx.set.status = 200;
      return successResponse(correlationId, "Mapping updated successfully", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to update mapping", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async deleteByUserId(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const { userId } = ctx.params as { userId: string };
      if (!userId) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "User ID is required", 400);
      }

      await db.delete(userWarehouseMappings).where(eq(userWarehouseMappings.userId, userId));
      
      const user = await UserModel.findById(userId);
      if (user?.role?.code === "warehouse_head") {
        await db.delete(warehouseHeads).where(eq(warehouseHeads.userId, userId));
      }

      await logActivity({
        userId: ctx.user?.sub,
        action: "DELETE_MAPPING",
        module: "USER_WAREHOUSE_MAPPING",
        description: `User ${ctx.user?.email} menghapus pemetaan gudang untuk user ID ${userId}`,
      });

      ctx.set.status = 200;
      return successResponse(correlationId, "Mapping deleted successfully", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to delete mapping", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
