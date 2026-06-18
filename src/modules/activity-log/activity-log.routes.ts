import { Elysia } from "elysia";
import { ActivityLogController } from "./activity-log.controller";
import { authMiddleware } from "../auth/auth.middleware";

/**
 * Activity Log Routes
 *
 * GET /api/activity-logs → Monitoring log aktivitas dengan filter & pagination
 */
export const activityLogRoutes = new Elysia({ prefix: "/api/activity-logs" })
  .use(authMiddleware)
  .get("/", ActivityLogController.getAll);
