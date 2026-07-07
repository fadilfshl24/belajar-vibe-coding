import { pgTable, uuid, boolean, index } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { roles } from "../role/role.schema";
import { menus } from "../menu/menu.schema";

/**
 * Tabel: role_menu_permissions
 *
 * Tabel mapping yang mendefinisikan hak akses (CRUD) setiap role terhadap menu.
 * Dapat dikonfigurasi secara dinamis oleh Superadmin melalui menu Role Menu Management.
 *
 * Kolom permission:
 * - can_view   : Boleh melihat halaman/menu
 * - can_create : Boleh menambah data
 * - can_update : Boleh mengubah data
 * - can_delete : Boleh menghapus data
 */
export const roleMenuPermissions = pgTable(
  "role_menu_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menus.id),
    canView: boolean("can_view").notNull().default(false),
    canCreate: boolean("can_create").notNull().default(false),
    canUpdate: boolean("can_update").notNull().default(false),
    canDelete: boolean("can_delete").notNull().default(false),
    canAccessApi: boolean("can_access_api").notNull().default(false),
    ...auditColumns,
  },
  (t) => [
    index("idx_rmp_role_id").on(t.roleId),
    index("idx_rmp_menu_id").on(t.menuId),
  ]
);

export type RoleMenuPermissionRecord = typeof roleMenuPermissions.$inferSelect;
export type RoleMenuPermissionInsert = typeof roleMenuPermissions.$inferInsert;
