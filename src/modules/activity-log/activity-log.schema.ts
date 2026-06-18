import { pgTable, uuid, varchar, text, index } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { users } from "../user/user.schema";

/**
 * Tabel: activity_logs
 *
 * Menyimpan log audit aktivitas pengguna secara append-only.
 * Data log tidak dihapus secara fisik (soft delete bersifat opsional).
 *
 * Kolom username disimpan secara redundan untuk kemudahan audit,
 * sehingga log tetap terbaca meskipun user sudah dihapus.
 *
 * Format action standar: LOGIN, LOGOUT, CREATE_DATA, UPDATE_DATA,
 * DELETE_DATA, CREATE_ORDER, UPDATE_ORDER, DELETE_ORDER.
 */
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id), // Nullable untuk aksi sistem/guest
    username: varchar("username", { length: 255 }), // Disimpan agar audit tidak rusak jika user didelete
    action: varchar("action", { length: 100 }).notNull(),
    description: text("description").notNull(),
    ipAddress: varchar("ip_address", { length: 255 }),
    userAgent: text("user_agent"),
    ...auditColumns,
  },
  (t) => [
    index("idx_activity_logs_user_id").on(t.userId),
    index("idx_activity_logs_action").on(t.action),
    index("idx_activity_logs_created_at").on(t.createdAt),
  ]
);

export type ActivityLogRecord = typeof activityLogs.$inferSelect;
export type ActivityLogInsert = typeof activityLogs.$inferInsert;
