import { Elysia } from "elysia";
import { UomController } from "./uom.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const uomRoutes = new Elysia({ prefix: "/api/uoms" })
  .use(authMiddleware)
  .get("/", UomController.getAll, { beforeHandle: [permissionGuard("uom", "canView")] })
  .get("/:id", UomController.getById, { beforeHandle: [permissionGuard("uom", "canView")] })
  .post("/", UomController.create, { beforeHandle: [permissionGuard("uom", "canCreate")] })
  .put("/:id", UomController.update, { beforeHandle: [permissionGuard("uom", "canUpdate")] })
  .delete("/:id", UomController.remove, { beforeHandle: [permissionGuard("uom", "canDelete")] });
