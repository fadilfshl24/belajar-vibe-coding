import { Elysia } from "elysia";
import { UserController } from "./user.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

/**
 * User Routes
 *
 * Semua route memerlukan autentikasi (Bearer token).
 *
 * POST   /         → Register user baru
 * GET    /         → List semua user (paginated)
 * GET    /:id      → Get user by ID
 * PATCH  /:id/status → Update status user
 * DELETE /:id      → Soft delete user
 */
export const userRoutes = new Elysia({ prefix: "/api/users" })
  .use(authMiddleware)
  .post("/", UserController.register, { beforeHandle: [permissionGuard("user_management", "canCreate")] })
  .put("/:id", UserController.updateUser, { beforeHandle: [permissionGuard("user_management", "canUpdate")] })
  .get("/", UserController.getAll, { beforeHandle: [permissionGuard("user_management", "canView")] })
  .get("/:id", UserController.getById, { beforeHandle: [permissionGuard("user_management", "canView")] })
  .patch("/:id/status", UserController.updateStatus, { beforeHandle: [permissionGuard("user_management", "canUpdate")] })
  .delete("/:id", UserController.deleteUser, { beforeHandle: [permissionGuard("user_management", "canDelete")] });
