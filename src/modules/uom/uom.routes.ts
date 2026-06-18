import { Elysia } from "elysia";
import { UomController } from "./uom.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const uomRoutes = new Elysia({ prefix: "/api/uoms" })
  .use(authMiddleware)
  .get("/", UomController.getAll)
  .get("/:id", UomController.getById)
  .post("/", UomController.create)
  .put("/:id", UomController.update)
  .delete("/:id", UomController.remove);
