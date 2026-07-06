import { Elysia } from "elysia";
import { WarehouseController, WarehouseHeadController, WarehouseRegionController } from "./warehouse.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const warehouseRoutes = new Elysia({ prefix: "/api/warehouses" })
  .use(authMiddleware)
  // Standard CRUD
  .get("/", WarehouseController.getAll, { beforeHandle: [permissionGuard("gudang", "canView")] })
  .get("/:id", WarehouseController.getById, { beforeHandle: [permissionGuard("gudang", "canView")] })
  .post("/", WarehouseController.create, { beforeHandle: [permissionGuard("gudang", "canCreate")] })
  .put("/:id", WarehouseController.update, { beforeHandle: [permissionGuard("gudang", "canUpdate")] })
  .delete("/:id", WarehouseController.remove, { beforeHandle: [permissionGuard("gudang", "canDelete")] })
  // Warehouse Heads sub-routes
  .get("/:id/heads", WarehouseHeadController.getByWarehouse, { beforeHandle: [permissionGuard("gudang", "canView")] })
  .post("/:id/heads", WarehouseHeadController.assign, { beforeHandle: [permissionGuard("gudang", "canUpdate")] })
  .delete("/:id/heads/:headId", WarehouseHeadController.unassign, { beforeHandle: [permissionGuard("gudang", "canUpdate")] });

/**
 * Separate region routes under /api/warehouse-regions to avoid /:id conflict
 */
export const warehouseRegionRoutes = new Elysia({ prefix: "/api/warehouse-regions" })
  .use(authMiddleware)
  .get("/provinces", WarehouseRegionController.getProvinces, { beforeHandle: [permissionGuard("gudang", "canView")] })
  .get("/cities", WarehouseRegionController.getCitiesByProvince, { beforeHandle: [permissionGuard("gudang", "canView")] })
  .get("/warehouses", WarehouseRegionController.getByRegion, { beforeHandle: [permissionGuard("gudang", "canView")] });

