import { Elysia } from "elysia";
import { PlatformController } from "./platform.controller";

export const platformRoutes = new Elysia().use(PlatformController.routes);
