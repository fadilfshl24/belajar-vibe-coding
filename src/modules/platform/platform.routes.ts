import { Elysia } from "elysia";
import { PlatformController } from "./platform.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const platformRoutes = new Elysia({ prefix: "/api/platforms" })
  .use(authMiddleware)
  .get("/", PlatformController.getAll, {
    beforeHandle: [permissionGuard("platform", "canView")],
  })
  .get("/:id", PlatformController.getById, {
    beforeHandle: [permissionGuard("platform", "canView")],
  })
  .post("/", PlatformController.create, {
    beforeHandle: [permissionGuard("platform", "canCreate")],
  })
  .put("/:id", PlatformController.update, {
    beforeHandle: [permissionGuard("platform", "canUpdate")],
  })
  .delete("/:id", PlatformController.delete, {
    beforeHandle: [permissionGuard("platform", "canDelete")],
  });
