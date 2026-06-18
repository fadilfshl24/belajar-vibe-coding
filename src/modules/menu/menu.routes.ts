import { Elysia } from "elysia";
import { MenuController } from "./menu.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const menuRoutes = new Elysia({ prefix: "/api/menus" })
  .use(authMiddleware)
  .get("/", MenuController.getAll)
  .get("/:id", MenuController.getById)
  .post("/", MenuController.create)
  .put("/:id", MenuController.update)
  .delete("/:id", MenuController.remove);
