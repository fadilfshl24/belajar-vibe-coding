import type { Context } from "elysia";
import { failedResponse, successResponse } from "../../core/utils/response";
import { PermissionModel } from "./permission.model";
import { parseBulkUpdatePermissionsInput, parseBulkUpdateByRoleInput } from "./permission.validation";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";

export class PermissionController {
  // ---------------------------------------------------------------------------
  // GET /api/role-permissions — Ambil seluruh matriks permission
  // ---------------------------------------------------------------------------
  static async getMatrix(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const matrix = await PermissionModel.getPermissionMatrix();
      return successResponse(correlationId, "Data found!", { records: matrix });
    } catch (err: unknown) {
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  // ---------------------------------------------------------------------------
  // PUT /api/role-permissions — Bulk update permissions (Superadmin only)
  // ---------------------------------------------------------------------------
  static async bulkUpdate(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseBulkUpdatePermissionsInput(ctx.body);
      if (!parsed.success) {
        return failedResponse(
          correlationId,
          "Update data failed!",
          400,
          parsed.error.issues[0]?.message ?? "Input invalid!"
        );
      }

      const menuIds = parsed.data.permissions.map(p => p.menuId);
      const parentIds = await PermissionModel.getParentMenuIds(menuIds);
      // We filter out parent menu permissions instead of throwing an error, or just allow them.
      // Let's filter them out to prevent database clutter if they aren't used, or just let them save.
      // Since UI sends them, it's safest to just save them so UI state is consistent.

      await PermissionModel.bulkUpsert(parsed.data.permissions, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_PERMISSION",
        description: `User ${ctx.user?.email} mengubah konfigurasi hak akses role menu (${parsed.data.permissions.length} item)`,
      });

      return successResponse(correlationId, "Permissions have been updated", null);
    } catch (err: unknown) {
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  // ---------------------------------------------------------------------------
  // GET /api/roles/:id/permissions
  // ---------------------------------------------------------------------------
  static async getByRoleId(ctx: Context & { params: { id: string } }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const matrix = await PermissionModel.getMatrixByRoleId(ctx.params.id);
      return successResponse(correlationId, "Data found!", matrix);
    } catch (err: unknown) {
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  // ---------------------------------------------------------------------------
  // PUT /api/roles/:id/permissions
  // ---------------------------------------------------------------------------
  static async bulkUpdateByRoleId(ctx: Context & { params: { id: string }, user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseBulkUpdateByRoleInput(ctx.body);
      if (!parsed.success) {
        return failedResponse(
          correlationId,
          "Update data failed!",
          400,
          parsed.error.issues[0]?.message ?? "Input invalid!"
        );
      }

      const roleId = ctx.params.id;
      const permissionsToUpdate = parsed.data.permissions.map(p => ({
        ...p,
        roleId,
      }));

      const menuIds = permissionsToUpdate.map(p => p.menuId);
      const parentIds = await PermissionModel.getParentMenuIds(menuIds);
      
      // Filter out parent menus silently so we don't throw error and don't insert invalid data
      // OR we just allow it so the UI state remains consistent. Let's allow it for now.

      await PermissionModel.bulkUpsert(permissionsToUpdate, ctx.user?.sub);

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_PERMISSION",
        description: `User ${ctx.user?.email} mengubah konfigurasi hak akses role menu (${permissionsToUpdate.length} item) untuk role ID ${roleId}`,
      });

      return successResponse(correlationId, "Permissions have been updated", null);
    } catch (err: unknown) {
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
