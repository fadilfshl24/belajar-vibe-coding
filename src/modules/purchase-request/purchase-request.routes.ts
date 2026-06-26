import { Elysia } from "elysia";
import { PurchaseRequestController } from "./purchase-request.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const purchaseRequestRoutes = new Elysia({ prefix: "/api/purchase-requests" })
  .use(authMiddleware)
  .get("/", PurchaseRequestController.getAll, {
    beforeHandle: [permissionGuard("purchase_request", "canView")],
  })
  .get("/:id", PurchaseRequestController.getById, {
    beforeHandle: [permissionGuard("purchase_request", "canView")],
  })
  .post("/", PurchaseRequestController.create, {
    beforeHandle: [permissionGuard("purchase_request", "canCreate")],
  })
  .put("/:id", PurchaseRequestController.update, {
    beforeHandle: [permissionGuard("purchase_request", "canUpdate")],
  })
  .patch("/:id/status", PurchaseRequestController.updateStatus, {
    beforeHandle: [permissionGuard("purchase_request", "canUpdate")],
  })
  .delete("/:id", PurchaseRequestController.delete, {
    beforeHandle: [permissionGuard("purchase_request", "canDelete")],
  });
