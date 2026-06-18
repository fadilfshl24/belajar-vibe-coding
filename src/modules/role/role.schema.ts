import { pgTable, uuid, varchar, text, index } from "drizzle-orm/pg-core";
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
    name: varchar("name", { length: 255 }).notNull().unique(),
    description: text("description"),
    ...auditColumns,
  },
  (t) => [
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

export type RoleRecord = typeof roles.$inferSelect;
export type RoleInsert = typeof roles.$inferInsert;
export type UserWarehouseRoleRecord = typeof userWarehouseRoles.$inferSelect;
export type UserWarehouseRoleInsert = typeof userWarehouseRoles.$inferInsert;
