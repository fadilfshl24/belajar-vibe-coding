import { Elysia } from "elysia";
import { UserController } from "./user.controller";
import { authMiddleware } from "../auth/auth.middleware";

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
  .post("/", UserController.register)
  .get("/", UserController.getAll)
  .get("/:id", UserController.getById)
  .patch("/:id/status", UserController.updateStatus)
  .delete("/:id", UserController.deleteUser);
