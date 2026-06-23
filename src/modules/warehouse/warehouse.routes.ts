import { Elysia } from "elysia";
import { WarehouseController, WarehouseHeadController } from "./warehouse.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const warehouseRoutes = new Elysia({ prefix: "/api/warehouses" })
  .use(authMiddleware)
  .get("/", WarehouseController.getAll, { beforeHandle: [permissionGuard("gudang", "canView")] })
  .get("/:id", WarehouseController.getById, { beforeHandle: [permissionGuard("gudang", "canView")] })
  .post("/", WarehouseController.create, { beforeHandle: [permissionGuard("gudang", "canCreate")] })
  .put("/:id", WarehouseController.update, { beforeHandle: [permissionGuard("gudang", "canUpdate")] })
  .delete("/:id", WarehouseController.remove, { beforeHandle: [permissionGuard("gudang", "canDelete")] })
  // Warehouse Heads sub-routes (also require gudang permissions)
  .get("/:id/heads", WarehouseHeadController.getByWarehouse, { beforeHandle: [permissionGuard("gudang", "canView")] })
  .post("/:id/heads", WarehouseHeadController.assign, { beforeHandle: [permissionGuard("gudang", "canUpdate")] })
  .delete("/heads/:headId", WarehouseHeadController.unassign, { beforeHandle: [permissionGuard("gudang", "canUpdate")] });
