import { Elysia } from "elysia";
import { failedResponse } from "../../core/utils/response";
import { PermissionModel } from "./permission.model";

/**
 * permissionGuard
 *
 * Factory middleware yang mengecek hak akses role terhadap menu tertentu
 * sebelum request diteruskan ke controller.
 *
 * Middleware ini harus dipasang SETELAH authMiddleware karena membutuhkan
 * `user` yang sudah di-inject oleh authMiddleware.
 *
 * CATATAN: Karena sistem menggunakan tabel pivot user_warehouse_roles,
 * guard ini memerlukan roleId dikirim via header `x-role-id` atau
 * query param `roleId` untuk menentukan role mana yang aktif.
 *
 * @param menuCode - Kode menu yang ingin diakses (e.g., "master_data")
 * @param action   - Jenis aksi: "canView" | "canCreate" | "canUpdate" | "canDelete"
 *
 * @example
 * app.get("/api/master-data", handler, { beforeHandle: [permissionGuard("master_data", "canView")] })
 *
 * // Atau via .use():
 * new Elysia()
 *   .use(authMiddleware)
 *   .use(permissionGuard("master_data", "canView"))
 *   .get("/", handler)
 */
export function permissionGuard(
  menuCode: string,
  action: "canView" | "canCreate" | "canUpdate" | "canDelete"
) {
  return new Elysia({ name: `permissionGuard:${menuCode}:${action}` }).derive(
    { as: "scoped" },
    async ({ headers, set }: any) => {
      const correlationId =
        (headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

      // Ambil roleId dari header khusus (dikirim oleh client bersama token)
      const roleId = headers["x-role-id"] as string | undefined;

      if (!roleId) {
        set.status = 403;
        throw new Response(
          JSON.stringify(
            failedResponse(correlationId, "Access denied.", 403, "Role ID is required in header x-role-id")
          ),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      const hasAccess = await PermissionModel.checkAccess(roleId, menuCode, action);

      if (!hasAccess) {
        set.status = 403;
        throw new Response(
          JSON.stringify(
            failedResponse(
              correlationId,
              "Access denied.",
              403,
              `Role does not have '${action}' permission for menu '${menuCode}'`
            )
          ),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      return { roleId };
    }
  );
}
