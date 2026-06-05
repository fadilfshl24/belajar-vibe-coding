import { Elysia } from "elysia";
import { UserController } from "../controllers/UserController";

export const userRoutes = new Elysia().post("/", UserController.register);
