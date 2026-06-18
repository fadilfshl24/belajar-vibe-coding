import { Elysia } from "elysia";
import { CategoryController } from "./category.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const categoryRoutes = new Elysia({ prefix: "/api/categories" })
  .use(authMiddleware)
  .get("/", CategoryController.getAll)
  .get("/:id", CategoryController.getById)
  .post("/", CategoryController.create)
  .put("/:id", CategoryController.update)
  .delete("/:id", CategoryController.remove);
