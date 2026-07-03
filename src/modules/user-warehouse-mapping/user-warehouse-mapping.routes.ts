import { Elysia } from "elysia";
import { UserWarehouseMappingController } from "./user-warehouse-mapping.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const userWarehouseMappingRoutes = new Elysia({ prefix: "/api/user-warehouse-mappings" })
  .use(authMiddleware)
  .get("/", UserWarehouseMappingController.getAll, { beforeHandle: [permissionGuard("user_warehouse_mapping", "canView")] })
  .post("/", UserWarehouseMappingController.createOrUpdate, { beforeHandle: [permissionGuard("user_warehouse_mapping", "canCreate")] })
  .delete("/:userId", UserWarehouseMappingController.deleteByUserId, { beforeHandle: [permissionGuard("user_warehouse_mapping", "canDelete")] });
