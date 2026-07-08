import { Elysia } from "elysia";
import { ReportController } from "./report.controller";
import { authMiddleware } from "../auth";

export const reportRoutes = new Elysia({ prefix: "/api/reports" })
  .use(authMiddleware)
  .get(
    "/price-history",
    ReportController.getPriceHistory
  );
