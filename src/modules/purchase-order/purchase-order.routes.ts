import { Elysia } from "elysia";
import { PurchaseOrderController } from "./purchase-order.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const purchaseOrderRoutes = new Elysia({ prefix: "/api/purchase-orders" })
  .use(authMiddleware)
  .get("/", PurchaseOrderController.getAll, {
    beforeHandle: [permissionGuard("purchase_order", "canView")],
  })
  .get("/:id", PurchaseOrderController.getById, {
    beforeHandle: [permissionGuard("purchase_order", "canView")],
  })
  .post("/", PurchaseOrderController.create, {
    beforeHandle: [permissionGuard("purchase_order", "canCreate")],
  })
  .put("/:id", PurchaseOrderController.update, {
    beforeHandle: [permissionGuard("purchase_order", "canUpdate")],
  })
  .patch("/:id/status", PurchaseOrderController.updateStatus, {
    beforeHandle: [permissionGuard("purchase_order", "canUpdate")],
  })
  .post("/:id/receive", PurchaseOrderController.receiveGoods, {
    beforeHandle: [permissionGuard("purchase_order", "canUpdate")],
  })
  .delete("/:id", PurchaseOrderController.delete, {
    beforeHandle: [permissionGuard("purchase_order", "canDelete")],
  });
