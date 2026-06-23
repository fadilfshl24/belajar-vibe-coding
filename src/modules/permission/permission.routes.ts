import { Elysia } from "elysia";
import { PermissionController } from "./permission.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "./permission.middleware";

/**
 * Permission Routes
 *
 * GET /api/role-permissions        → Ambil matriks permission semua role
 * PUT /api/role-permissions        → Bulk update permissions (Superadmin only)
 */
export const permissionRoutes = new Elysia({ prefix: "/api/role-permissions" })
  .use(authMiddleware)
  .get("/", PermissionController.getMatrix, { beforeHandle: [permissionGuard("permission_management", "canView")] })
  .put("/", PermissionController.bulkUpdate, { beforeHandle: [permissionGuard("permission_management", "canUpdate")] });
