import { Elysia } from "elysia";
import { UserController } from "../controllers/UserController";

export const userRoutes = new Elysia()
  .post("/", UserController.register)
  .get("/", UserController.getAll)
  .get("/:id", UserController.getById)
  .patch("/:id/status", UserController.updateStatus)
  .delete("/:id", UserController.deleteUser);
