import { Elysia } from "elysia";
import { WarehouseController, WarehouseHeadController } from "./warehouse.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const warehouseRoutes = new Elysia({ prefix: "/api/warehouses" })
  .use(authMiddleware)
  .get("/", WarehouseController.getAll)
  .get("/:id", WarehouseController.getById)
  .post("/", WarehouseController.create)
  .put("/:id", WarehouseController.update)
  .delete("/:id", WarehouseController.remove)
  // Warehouse Heads sub-routes
  .get("/:id/heads", WarehouseHeadController.getByWarehouse)
  .post("/:id/heads", WarehouseHeadController.assign)
  .delete("/heads/:headId", WarehouseHeadController.unassign);
