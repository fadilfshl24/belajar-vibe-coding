import { pgTable, uuid, varchar, smallint, timestamp, boolean, text } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// 1. Tabel Users
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }), // Nullable untuk mengakomodasi login OAuth
  status: smallint("status").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

// ---------------------------------------------------------------------------
// 2. Tabel Roles (Role Management)
// ---------------------------------------------------------------------------
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(), // superadmin, admin, warehouse_head, staff, user
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

// ---------------------------------------------------------------------------
// 3. Tabel Menus (Menu Management)
// ---------------------------------------------------------------------------
export const menus = pgTable("menus", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 255 }).notNull().unique(), // e.g., master_data, order_management
  path: varchar("path", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

// ---------------------------------------------------------------------------
// 4. Tabel Role Menu Permissions
// ---------------------------------------------------------------------------
export const roleMenuPermissions = pgTable("role_menu_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  menuId: uuid("menu_id").notNull().references(() => menus.id),
  canView: boolean("can_view").notNull().default(false),
  canCreate: boolean("can_create").notNull().default(false),
  canUpdate: boolean("can_update").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

// ---------------------------------------------------------------------------
// 5. Tabel User Sessions (Session-based Auth)
// ---------------------------------------------------------------------------
export const userSessions = pgTable("user_sessions", {
  id: varchar("id", { length: 255 }).primaryKey(), // Session ID / Session Token
  userId: uuid("user_id").notNull().references(() => users.id),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 255 }),
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

// ---------------------------------------------------------------------------
// 6. Tabel User OAuth Accounts
// ---------------------------------------------------------------------------
export const userOauthAccounts = pgTable("user_oauth_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  provider: varchar("provider", { length: 50 }).notNull(), // google, facebook, gitlab
  providerUserId: varchar("provider_user_id", { length: 255 }).notNull(), // ID unik dari provider
  providerEmail: varchar("provider_email", { length: 255 }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

// ---------------------------------------------------------------------------
// 7. Tabel Activity Logs
// ---------------------------------------------------------------------------
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  username: varchar("username", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(), // LOGIN, LOGOUT, CREATE_DATA, etc.
  description: text("description").notNull(),
  ipAddress: varchar("ip_address", { length: 255 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

