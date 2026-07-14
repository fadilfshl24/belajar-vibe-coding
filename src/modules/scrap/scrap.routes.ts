import { Elysia } from "elysia";
import { ScrapController } from "./scrap.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const scrapRoutes = new Elysia({ prefix: "/api/scraps" })
  .use(authMiddleware)
  .get("/", ScrapController.getAll)
  .get("/:id", ScrapController.getById)
  .post("/", ScrapController.create)
  .post("/:id/approve", ScrapController.approve)
  .post("/:id/reject", ScrapController.reject);
