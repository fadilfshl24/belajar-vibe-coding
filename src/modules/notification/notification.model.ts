import { db } from "../../core/db";
import { notifications, userNotifications } from "./notification.schema";
import { userWarehouseMappings, userWarehouseRoles, roles } from "../role/role.schema";
import { users } from "../user/user.schema";
import { eq, and, isNull, inArray, ilike, sql, desc, count } from "drizzle-orm";
import type { NotificationSourceType } from "./notification.schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationListParams {
  page: number;
  limit: number;
  searchTerm?: string;
  status?: "all" | "read" | "unread";
  sourceType?: NotificationSourceType;
}

export interface CreateNotificationParams {
  sourceType: NotificationSourceType;
  sourceId: string;
  title: string;
  message: string;
  targetRole?: string;
  targetWarehouseId?: string;
}

// ─── Notification Code Generator ─────────────────────────────────────────────

async function generateNotificationCode(sourceType: string): Promise<string> {
  const prefix = `NTF-${sourceType}`;
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const countResult = await db
    .select({ count: count() })
    .from(notifications)
    .where(ilike(notifications.code, `${prefix}-${dateStr}%`));

  const seq = ((countResult[0]?.count ?? 0) + 1).toString().padStart(4, "0");
  return `${prefix}-${dateStr}-${seq}`;
}

// ─── Notification Model ───────────────────────────────────────────────────────

export class NotificationModel {
  /**
   * Fetch paginated notifications for a user with role-based filtering.
   */
  static async findAll(userId: string, params: NotificationListParams) {
    const offset = (params.page - 1) * params.limit;

    // Build base query with joins
    const conditions = [
      eq(userNotifications.userId, userId),
      isNull(userNotifications.deletedAt),
      isNull(notifications.deletedAt),
    ];

    if (params.status === "read") {
      conditions.push(eq(userNotifications.isRead, true));
    } else if (params.status === "unread") {
      conditions.push(eq(userNotifications.isRead, false));
    }

    if (params.sourceType) {
      conditions.push(eq(notifications.sourceType, params.sourceType));
    }

    if (params.searchTerm) {
      conditions.push(ilike(notifications.title, `%${params.searchTerm}%`));
    }

    const rows = await db
      .select({
        id: userNotifications.id,
        notificationId: notifications.id,
        code: notifications.code,
        title: notifications.title,
        message: notifications.message,
        sourceType: notifications.sourceType,
        sourceId: notifications.sourceId,
        isRead: userNotifications.isRead,
        readAt: userNotifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(userNotifications)
      .innerJoin(notifications, eq(userNotifications.notificationId, notifications.id))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(params.limit)
      .offset(offset);

    return rows;
  }

  /**
   * Count total for pagination.
   */
  static async countAll(userId: string, params: NotificationListParams): Promise<number> {
    const conditions = [
      eq(userNotifications.userId, userId),
      isNull(userNotifications.deletedAt),
      isNull(notifications.deletedAt),
    ];

    if (params.status === "read") {
      conditions.push(eq(userNotifications.isRead, true));
    } else if (params.status === "unread") {
      conditions.push(eq(userNotifications.isRead, false));
    }

    if (params.sourceType) {
      conditions.push(eq(notifications.sourceType, params.sourceType));
    }

    if (params.searchTerm) {
      conditions.push(ilike(notifications.title, `%${params.searchTerm}%`));
    }

    const result = await db
      .select({ count: count() })
      .from(userNotifications)
      .innerJoin(notifications, eq(userNotifications.notificationId, notifications.id))
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  /**
   * Get unread count for a user.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(userNotifications)
      .innerJoin(notifications, eq(userNotifications.notificationId, notifications.id))
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.isRead, false),
          isNull(userNotifications.deletedAt),
          isNull(notifications.deletedAt)
        )
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Mark a single notification as read for the user.
   */
  static async markRead(userId: string, userNotificationId: string) {
    const result = await db
      .update(userNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, userNotificationId),
          eq(userNotifications.userId, userId),
          isNull(userNotifications.deletedAt)
        )
      )
      .returning();

    return result[0] ?? null;
  }

  /**
   * Mark all unread notifications as read for the user.
   */
  static async markAllRead(userId: string) {
    await db
      .update(userNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.isRead, false),
          isNull(userNotifications.deletedAt)
        )
      );
  }

  /**
   * Soft-delete a user notification.
   */
  static async softDelete(userId: string, userNotificationId: string) {
    const result = await db
      .update(userNotifications)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, userNotificationId),
          eq(userNotifications.userId, userId),
          isNull(userNotifications.deletedAt)
        )
      )
      .returning();

    return result[0] ?? null;
  }

  /**
   * Get recent notifications for bell popover (limit 5).
   */
  static async getRecent(userId: string, limit = 5) {
    return db
      .select({
        id: userNotifications.id,
        notificationId: notifications.id,
        code: notifications.code,
        title: notifications.title,
        message: notifications.message,
        sourceType: notifications.sourceType,
        sourceId: notifications.sourceId,
        isRead: userNotifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(userNotifications)
      .innerJoin(notifications, eq(userNotifications.notificationId, notifications.id))
      .where(
        and(
          eq(userNotifications.userId, userId),
          isNull(userNotifications.deletedAt),
          isNull(notifications.deletedAt)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  /**
   * Create a notification and dispatch to target users based on warehouseId + role.
   * Returns the notification record + list of userIds that received it.
   */
  static async createAndDispatch(params: CreateNotificationParams): Promise<{
    notification: any;
    recipientUserIds: string[];
  }> {
    const code = await generateNotificationCode(params.sourceType);

    // 1. Insert master notification
    const [notif] = await db
      .insert(notifications)
      .values({
        code,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        title: params.title,
        message: params.message,
        targetRole: params.targetRole,
        targetWarehouseId: params.targetWarehouseId,
      })
      .returning();

    if (!notif) throw new Error("Failed to create notification");

    // 2. Find target users
    let recipientUserIds: string[] = [];

    if (params.targetWarehouseId && params.targetRole) {
      // Get users with the target role mapped to the target warehouse
      const mappedUsers = await db
        .select({ userId: userWarehouseMappings.userId })
        .from(userWarehouseMappings)
        .innerJoin(userWarehouseRoles, eq(userWarehouseRoles.userId, userWarehouseMappings.userId))
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(
          and(
            eq(userWarehouseMappings.warehouseId, params.targetWarehouseId),
            eq(roles.code, params.targetRole),
            eq(userWarehouseMappings.isActive, true),
            isNull(userWarehouseMappings.deletedAt),
            isNull(userWarehouseRoles.deletedAt),
            isNull(roles.deletedAt)
          )
        );

      recipientUserIds = mappedUsers.map((u) => u.userId);
    } else if (params.targetRole === "superadmin" || params.targetRole === "admin") {
      // Global admins: find all superadmin/admin users
      const adminUsers = await db
        .select({ userId: userWarehouseRoles.userId })
        .from(userWarehouseRoles)
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(
          and(
            inArray(roles.code, ["superadmin", "admin"]),
            isNull(userWarehouseRoles.deletedAt),
            isNull(roles.deletedAt)
          )
        );

      recipientUserIds = [...new Set(adminUsers.map((u) => u.userId))];
    }

    // 3. Insert user_notifications for each recipient
    if (recipientUserIds.length > 0) {
      await db.insert(userNotifications).values(
        recipientUserIds.map((userId) => ({
          userId,
          notificationId: notif.id,
          isRead: false,
        }))
      );
    }

    return { notification: notif, recipientUserIds };
  }
}
