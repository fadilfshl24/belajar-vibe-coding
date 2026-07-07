import { Elysia } from "elysia";
import { CustomerController } from "./customer.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const customerRoutes = new Elysia({ prefix: "/api/customers" })
  .use(authMiddleware)
  .get("/", CustomerController.getAll, {
    beforeHandle: [permissionGuard("customer", ["canView", "canAccessApi"])],
  })
  .get("/:id", CustomerController.getById, {
    beforeHandle: [permissionGuard("customer", ["canView", "canAccessApi"])],
  })
  .post("/", CustomerController.create, {
    beforeHandle: [permissionGuard("customer", "canCreate")],
  })
  .put("/:id", CustomerController.update, {
    beforeHandle: [permissionGuard("customer", "canUpdate")],
  })
  .delete("/:id", CustomerController.delete, {
    beforeHandle: [permissionGuard("customer", "canDelete")],
  });
