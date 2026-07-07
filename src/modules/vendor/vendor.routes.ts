import { Elysia } from "elysia";
import { VendorController } from "./vendor.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const vendorRoutes = new Elysia({ prefix: "/api/vendors" })
  .use(authMiddleware)
  .get("/", VendorController.getAll, {
    beforeHandle: [permissionGuard("vendor", ["canView", "canAccessApi"])],
  })
  .get("/:id", VendorController.getById, {
    beforeHandle: [permissionGuard("vendor", ["canView", "canAccessApi"])],
  })
  .post("/", VendorController.create, {
    beforeHandle: [permissionGuard("vendor", "canCreate")],
  })
  .put("/:id", VendorController.update, {
    beforeHandle: [permissionGuard("vendor", "canUpdate")],
  })
  .delete("/:id", VendorController.delete, {
    beforeHandle: [permissionGuard("vendor", "canDelete")],
  });
