import { pgTable, uuid, varchar, text, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { users } from "../user/user.schema";
import { warehouses } from "../warehouse/warehouse.schema";

/**
 * Tabel: roles
 *
 * Menyimpan daftar role yang tersedia dalam sistem.
 * Role default: superadmin, admin, warehouse_head, staff, user.
 */
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    ...auditColumns,
  },
  (t) => [
    index("idx_roles_code").on(t.code),
    index("idx_roles_name").on(t.name),
    index("idx_roles_deleted_at").on(t.deletedAt),
  ]
);

/**
 * Tabel: user_warehouse_roles (Pivot Table)
 *
 * Tabel penengah yang mengizinkan satu user memiliki role yang berbeda
 * di setiap gudang. Misalnya: User A bisa menjadi "Staff" di Gudang Jakarta
 * dan "Warehouse Head" di Gudang Surabaya.
 *
 * Relasi:
 * - user_id     → users.id
 * - warehouse_id → warehouses.id
 * - role_id     → roles.id
 */
export const userWarehouseRoles = pgTable(
  "user_warehouse_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    ...auditColumns,
  },
  (t) => [
    index("idx_uwr_user_id").on(t.userId),
    index("idx_uwr_warehouse_id").on(t.warehouseId),
    index("idx_uwr_role_id").on(t.roleId),
  ]
);

/**
 * Tabel: user_warehouse_mappings
 *
 * Tabel yang memetakan user ke warehouse mana saja yang berhak mereka akses.
 * Hanya berlaku untuk non-superadmin.
 */
export const userWarehouseMappings = pgTable(
  "user_warehouse_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_uwm_user_id").on(t.userId),
    index("idx_uwm_warehouse_id").on(t.warehouseId),
    uniqueIndex("uq_user_warehouse").on(t.userId, t.warehouseId),
  ]
);

export type RoleRecord = typeof roles.$inferSelect;
export type RoleInsert = typeof roles.$inferInsert;
export type UserWarehouseRoleRecord = typeof userWarehouseRoles.$inferSelect;
export type UserWarehouseRoleInsert = typeof userWarehouseRoles.$inferInsert;
export type UserWarehouseMappingRecord = typeof userWarehouseMappings.$inferSelect;
export type UserWarehouseMappingInsert = typeof userWarehouseMappings.$inferInsert;
