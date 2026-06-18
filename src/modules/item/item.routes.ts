import { Elysia } from "elysia";
import { ItemController } from "./item.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const itemRoutes = new Elysia({ prefix: "/api/items" })
  .use(authMiddleware)
  .get("/", ItemController.getAll)
  .get("/:id", ItemController.getById)
  .post("/", ItemController.create)
  .put("/:id", ItemController.update)
  .delete("/:id", ItemController.remove);
