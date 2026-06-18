import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { users } from "../user/user.schema";

/**
 * Tabel: user_sessions
 *
 * Menyimpan sesi aktif pengguna (session-based auth).
 * Session ID digunakan sebagai Bearer token.
 */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(), // Session ID / Bearer token
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 255 }),
    expiresAt: timestamp("expires_at").notNull(),
    isRevoked: boolean("is_revoked").notNull().default(false),
    ...auditColumns,
  },
  (t) => [
    index("idx_user_sessions_user_id").on(t.userId),
    index("idx_user_sessions_expires_at").on(t.expiresAt),
  ]
);

/**
 * Tabel: user_oauth_accounts
 *
 * Menyimpan mapping akun OAuth (Google, Facebook, GitLab, GitHub)
 * ke user yang ada di sistem.
 */
export const userOauthAccounts = pgTable(
  "user_oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: varchar("provider", { length: 50 }).notNull(), // google, facebook, gitlab, github
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    providerEmail: varchar("provider_email", { length: 255 }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    ...auditColumns,
  },
  (t) => [
    index("idx_oauth_user_id").on(t.userId),
    index("idx_oauth_provider_user_id").on(t.provider, t.providerUserId),
  ]
);

export type UserSessionRecord = typeof userSessions.$inferSelect;
export type UserSessionInsert = typeof userSessions.$inferInsert;
export type UserOauthAccountRecord = typeof userOauthAccounts.$inferSelect;
export type UserOauthAccountInsert = typeof userOauthAccounts.$inferInsert;
