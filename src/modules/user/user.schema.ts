import { pgTable, uuid, varchar, smallint, index } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";

/**
 * Tabel: users
 *
 * Menyimpan data akun pengguna sistem.
 * Password bersifat nullable untuk mengakomodasi login via OAuth.
 *
 * Status:
 * - 1 = aktif
 * - 0 = nonaktif / diblokir
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }), // Nullable untuk OAuth login
    status: smallint("status").notNull().default(1),
    ...auditColumns,
  },
  (t) => [
    index("idx_users_email").on(t.email),
    index("idx_users_status").on(t.status),
    index("idx_users_deleted_at").on(t.deletedAt),
  ]
);

export type UserRecord = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
