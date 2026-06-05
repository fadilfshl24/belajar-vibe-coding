import { Elysia } from "elysia";
import { userRoutes } from "./userRoutes";
import { authRoutes } from "./authRoutes";

export const apiRoutes = new Elysia({ prefix: "/api" })
  .use(new Elysia({ prefix: "/users" }).use(userRoutes))
  .use(new Elysia({ prefix: "/auth" }).use(authRoutes));
