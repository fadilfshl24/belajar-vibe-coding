import { Elysia } from "elysia";
import { userRoutes } from "./userRoutes";

export const apiRoutes = new Elysia({ prefix: "/api" }).use(
  new Elysia({ prefix: "/users" }).use(userRoutes)
);
