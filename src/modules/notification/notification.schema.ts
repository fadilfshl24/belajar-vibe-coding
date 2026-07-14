import { pgTable, uuid, varchar, text, boolean, index, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "../user/user.schema";
import { warehouses } from "../warehouse/warehouse.schema";

export type NotificationSourceType = "PR" | "QP" | "PO" | "GR" | "QC";

// ─── Table: notifications ─────────────────────────────────────────────────────
// Stores master notification payloads generated from transactions.

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(),
    sourceType: varchar("source_type", { length: 50 }).$type<NotificationSourceType>().notNull(),
    sourceId: uuid("source_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    targetRole: varchar("target_role", { length: 50 }),
    targetWarehouseId: uuid("target_warehouse_id").references(() => warehouses.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("idx_notifications_source_type").on(t.sourceType),
    index("idx_notifications_source_id").on(t.sourceId),
    index("idx_notifications_target_warehouse_id").on(t.targetWarehouseId),
    index("idx_notifications_created_at").on(t.createdAt),
    index("idx_notifications_deleted_at").on(t.deletedAt),
  ]
);

// ─── Table: user_notifications ───────────────────────────────────────────────
// Junction table tracking read/unread status per user.

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    notificationId: uuid("notification_id").notNull().references(() => notifications.id),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("idx_user_notifications_user_id").on(t.userId),
    index("idx_user_notifications_notification_id").on(t.notificationId),
    index("idx_user_notifications_is_read").on(t.isRead),
    index("idx_user_notifications_deleted_at").on(t.deletedAt),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  targetWarehouse: one(warehouses, {
    fields: [notifications.targetWarehouseId],
    references: [warehouses.id],
  }),
  userNotifications: many(userNotifications),
}));

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  user: one(users, {
    fields: [userNotifications.userId],
    references: [users.id],
  }),
  notification: one(notifications, {
    fields: [userNotifications.notificationId],
    references: [notifications.id],
  }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationRecord = typeof notifications.$inferSelect;
export type NotificationInsert = typeof notifications.$inferInsert;
export type UserNotificationRecord = typeof userNotifications.$inferSelect;
export type UserNotificationInsert = typeof userNotifications.$inferInsert;
