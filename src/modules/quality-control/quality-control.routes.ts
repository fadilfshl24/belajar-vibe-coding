import { Elysia } from "elysia";
import { qualityControlController } from "./quality-control.controller";

export const qualityControlRoutes = new Elysia({ prefix: "/api/quality-controls" })
  .use(qualityControlController);
