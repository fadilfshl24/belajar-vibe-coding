import { Elysia } from "elysia";
import { DashboardController } from "./dashboard.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const dashboardRoutes = new Elysia({ prefix: "/api/dashboard" })
  .use(authMiddleware)
  .get("/kpi", DashboardController.getKpi)
  .get("/activities", DashboardController.getActivities);
