import { Elysia } from "elysia";
import { RoleController } from "./role.controller";
import { PermissionController } from "../permission/permission.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

/**
 * Role Routes — semua memerlukan autentikasi
 *
 * GET    /api/roles       → List semua roles
 * GET    /api/roles/:id   → Get role by ID
 * POST   /api/roles       → Buat role baru
 * PUT    /api/roles/:id   → Update role
 * DELETE /api/roles/:id   → Soft delete role
 */
export const roleRoutes = new Elysia({ prefix: "/api/roles" })
  .use(authMiddleware)
  .get("/", RoleController.getAll, { beforeHandle: [permissionGuard("role_management", "canView")] })
  .get("/:id", RoleController.getById, { beforeHandle: [permissionGuard("role_management", "canView")] })
  .post("/", RoleController.create, { beforeHandle: [permissionGuard("role_management", "canCreate")] })
  .put("/:id", RoleController.update, { beforeHandle: [permissionGuard("role_management", "canUpdate")] })
  .delete("/:id", RoleController.remove, { beforeHandle: [permissionGuard("role_management", "canDelete")] })
  .get("/:id/permissions", PermissionController.getByRoleId, { beforeHandle: [permissionGuard("role_management", "canView")] })
  .put("/:id/permissions", PermissionController.bulkUpdateByRoleId, { beforeHandle: [permissionGuard("role_management", "canUpdate")] });
