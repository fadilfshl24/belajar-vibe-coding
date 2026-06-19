import type { Context } from "elysia";
import { failedResponse, successResponse } from "../../core/utils/response";
import { PermissionModel } from "./permission.model";
import { parseBulkUpdatePermissionsInput } from "./permission.validation";
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
      if (parentIds.length > 0) {
        return failedResponse(
          correlationId,
          "Update data failed!",
          400,
          "Tidak bisa memberikan permission pada Parent Menu"
        );
      }

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
}
