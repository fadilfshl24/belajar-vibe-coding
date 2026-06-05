import { Elysia } from "elysia";
import { AuthController } from "../controllers/AuthController";
import { authMiddleware } from "../middlewares/authMiddleware";

export const authRoutes = new Elysia()
  .post("/login", AuthController.login)
  .post("/refresh-token", AuthController.refreshToken)
  // Protected routes — authMiddleware derives `user` and `correlationId` into ctx
  .use(authMiddleware)
  .post("/logout", AuthController.logout);
