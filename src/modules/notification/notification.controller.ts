import type { Context } from "elysia";
import { NotificationModel } from "./notification.model";
import { failedResponse, successResponse } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { logActivity } from "../../core/utils/activityLogger";
import type { NotificationListParams } from "./notification.model";
import type { NotificationSourceType } from "./notification.schema";

export class NotificationController {
  /**
   * GET /api/notifications
   * Fetch paginated notification list for the authenticated user.
   */
  static async getAll(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const userId = ctx.user?.sub;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const query = ctx.query as Record<string, string>;
      const params: NotificationListParams = {
        page: Math.max(1, parseInt(query.page ?? "1")),
        limit: Math.min(100, Math.max(1, parseInt(query.limit ?? "10"))),
        searchTerm: query.search || undefined,
        status: (query.status as "all" | "read" | "unread") || "all",
        sourceType: (query.sourceType as NotificationSourceType) || undefined,
      };

      const [total, records] = await Promise.all([
        NotificationModel.countAll(userId, params),
        NotificationModel.findAll(userId, params),
      ]);

      const totalPage = Math.ceil(total / params.limit) || 1;

      return successResponse(correlationId, "Data found!", { records }, {
        page: params.page,
        limit: params.limit,
        totalRecord: total,
        totalPage,
        nextPage: params.page < totalPage,
        previousPage: params.page > 1,
        nextPageURL: "",
        previousPageURL: "",
        filterColumn: params.sourceType ?? "",
        searchTerm: params.searchTerm ?? "",
        orderBy: "created_at DESC",
      });
    } catch (err) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  /**
   * GET /api/notifications/recent
   * Fetch 5 most recent notifications for bell popover.
   */
  static async getRecent(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const userId = ctx.user?.sub;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const records = await NotificationModel.getRecent(userId, 5);
      return successResponse(correlationId, "Data found!", { records });
    } catch (err) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Get count of unread notifications for the authenticated user.
   */
  static async getUnreadCount(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const userId = ctx.user?.sub;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const count = await NotificationModel.getUnreadCount(userId);
      return successResponse(correlationId, "OK", { count });
    } catch (err) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  /**
   * PUT /api/notifications/:id/read
   * Mark a specific notification as read.
   */
  static async markRead(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const userId = ctx.user?.sub;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const id = (ctx.params as Record<string, string>).id || "";
      const updated = await NotificationModel.markRead(userId, id);

      if (!updated) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Notification not found", 404);
      }

      await logActivity({
        userId,
        action: "READ_NOTIFICATION",
        module: "NOTIFICATION",
        description: `User membaca notifikasi dengan ID: ${id}`,
      });

      return successResponse(correlationId, "Notification marked as read", { record: updated });
    } catch (err) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  /**
   * PUT /api/notifications/read-all
   * Mark all notifications as read for the authenticated user.
   */
  static async markAllRead(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const userId = ctx.user?.sub;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      await NotificationModel.markAllRead(userId);

      await logActivity({
        userId,
        action: "READ_ALL_NOTIFICATIONS",
        module: "NOTIFICATION",
        description: `User menandai semua notifikasi sebagai sudah dibaca`,
      });

      return successResponse(correlationId, "All notifications marked as read", null);
    } catch (err) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Soft-delete a user notification.
   */
  static async deleteOne(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const userId = ctx.user?.sub;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const id = (ctx.params as Record<string, string>).id || "";
      const deleted = await NotificationModel.softDelete(userId, id);

      if (!deleted) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Notification not found", 404);
      }

      await logActivity({
        userId,
        action: "DELETE_NOTIFICATION",
        module: "NOTIFICATION",
        description: `User menghapus notifikasi dengan ID: ${id}`,
      });

      return successResponse(correlationId, "Notification deleted", null);
    } catch (err) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
