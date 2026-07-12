import { Elysia } from "elysia";
import { ItemPlatformSkuController } from "./item-platform-sku.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const itemPlatformSkuRoutes = new Elysia({ prefix: "/api/items" })
  .use(authMiddleware)
  .get("/:id/platform-skus", ItemPlatformSkuController.getByItemId, { beforeHandle: [permissionGuard("item", ["canView", "canAccessApi"])] })
  .post("/:id/platform-skus", ItemPlatformSkuController.create, { beforeHandle: [permissionGuard("item", "canUpdate")] })
  .delete("/platform-skus/:id", ItemPlatformSkuController.remove, { beforeHandle: [permissionGuard("item", "canUpdate")] });
