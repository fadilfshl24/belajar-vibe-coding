import { Elysia } from "elysia";
import { RoleController } from "./role.controller";
import { authMiddleware } from "../auth/auth.middleware";

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
  .get("/", RoleController.getAll)
  .get("/:id", RoleController.getById)
  .post("/", RoleController.create)
  .put("/:id", RoleController.update)
  .delete("/:id", RoleController.remove);
