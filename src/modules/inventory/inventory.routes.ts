import { Elysia } from "elysia";
import { InventoryController } from "./inventory.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const inventoryRoutes = new Elysia({ prefix: "/api/inventory" })
  .use(authMiddleware)
  .get("/", InventoryController.getAll, {
    beforeHandle: [permissionGuard("gudang", "canView")], // Assuming inventory is tied to warehouse access or maybe item access
  });
