import { Elysia } from "elysia";
import { ActivityLogController } from "./activity-log.controller";
import { authMiddleware } from "../auth/auth.middleware";

/**
 * Activity Log Routes
 *
 * GET /api/activity-logs         → Monitoring log aktivitas dengan filter & pagination
 * GET /api/activity-logs/filters → Daftar distinct modul & aksi untuk dropdown filter
 */
export const activityLogRoutes = new Elysia({ prefix: "/api/activity-logs" })
  .use(authMiddleware)
  .get("/filters", ActivityLogController.getFilters)
  .get("/", ActivityLogController.getAll);
