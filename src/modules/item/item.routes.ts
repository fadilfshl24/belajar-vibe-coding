import { Elysia } from "elysia";
import { ItemController } from "./item.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const itemRoutes = new Elysia({ prefix: "/api/items" })
  .use(authMiddleware)
  .get("/", ItemController.getAll, { beforeHandle: [permissionGuard("item", "canView")] })
  .get("/:id", ItemController.getById, { beforeHandle: [permissionGuard("item", "canView")] })
  .post("/", ItemController.create, { beforeHandle: [permissionGuard("item", "canCreate")] })
  .put("/:id", ItemController.update, { beforeHandle: [permissionGuard("item", "canUpdate")] })
  .delete("/:id", ItemController.remove, { beforeHandle: [permissionGuard("item", "canDelete")] });
