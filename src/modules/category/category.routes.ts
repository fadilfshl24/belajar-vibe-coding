import { Elysia } from "elysia";
import { CategoryController } from "./category.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const categoryRoutes = new Elysia({ prefix: "/api/categories" })
  .use(authMiddleware)
  .get("/", CategoryController.getAll, { beforeHandle: [permissionGuard("kategori", ["canView", "canAccessApi"])] })
  .get("/:id", CategoryController.getById, { beforeHandle: [permissionGuard("kategori", ["canView", "canAccessApi"])] })
  .post("/", CategoryController.create, { beforeHandle: [permissionGuard("kategori", "canCreate")] })
  .put("/:id", CategoryController.update, { beforeHandle: [permissionGuard("kategori", "canUpdate")] })
  .delete("/:id", CategoryController.remove, { beforeHandle: [permissionGuard("kategori", "canDelete")] });
