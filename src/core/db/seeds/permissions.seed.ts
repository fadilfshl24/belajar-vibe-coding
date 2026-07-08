import { db } from "../index";
import { roleMenuPermissions } from "../../../modules/permission/permission.schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Seed: Role Menu Permissions
 *
 * Mapping default hak akses sesuai matriks di issue #10.
 * Format: { roleName, menuCode, canView, canCreate, canUpdate, canDelete }
 *
 * Matriks Akses:
 * ✓ = true, ✗ = false
 *
 * | Menu                  | superadmin | admin | warehouse_head | staff | user |
 * |---------------------- |:----------:|:-----:|:--------------:|:-----:|:----:|
 * | full_system_settings  | CRUD       | ✗     | ✗              | ✗     | ✗    |
 * | role_menu_management  | CRUD       | ✗     | ✗              | ✗     | ✗    |
 * | master_data           | CRUD       | CRUD  | ✗              | ✗     | ✗    |
 * | configuration_app     | CRUD       | CRUD  | ✗              | ✗     | ✗    |
 * | user_management       | CRUD       | CRUD  | ✗              | ✗     | ✗    |
 * | warehouse_management  | CRUD       | CRUD  | CRUD           | ✗     | ✗    |
 * | inventory_management  | CRUD       | CRUD  | CRUD           | ✗     | ✗    |
 * | order_management      | CRUD       | CRUD  | ✗              | CRUD  | ✗    |
 * | activity_log          | View       | View  | ✗              | ✗     | ✗    |
 */

type PermissionEntry = {
  roleName: string;
  menuCode: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canAccessApi: boolean;
};

const ALL = { canView: true, canCreate: true, canUpdate: true, canDelete: true, canAccessApi: true };
const VIEW_ONLY = { canView: true, canCreate: false, canUpdate: false, canDelete: false, canAccessApi: true };
const NONE = { canView: false, canCreate: false, canUpdate: false, canDelete: false, canAccessApi: false };
const API_ONLY = { canView: false, canCreate: false, canUpdate: false, canDelete: false, canAccessApi: true };

export const DEFAULT_PERMISSIONS: PermissionEntry[] = [
  // --- Superadmin: akses penuh ke semua menu ---
  { roleName: "superadmin", menuCode: "dashboard", ...ALL },
  { roleName: "superadmin", menuCode: "barang_masuk", ...ALL },
  { roleName: "superadmin", menuCode: "barang_keluar", ...ALL },
  { roleName: "superadmin", menuCode: "item", ...ALL },
  { roleName: "superadmin", menuCode: "gudang", ...ALL },
  { roleName: "superadmin", menuCode: "kategori", ...ALL },
  { roleName: "superadmin", menuCode: "uom", ...ALL },
  { roleName: "superadmin", menuCode: "user_management", ...ALL },
  { roleName: "superadmin", menuCode: "role_management", ...ALL },
  { roleName: "superadmin", menuCode: "menu_management", ...ALL },
  { roleName: "superadmin", menuCode: "permission_management", ...ALL },
  { roleName: "superadmin", menuCode: "activity_log", ...VIEW_ONLY },
  { roleName: "superadmin", menuCode: "customer", ...ALL },
  { roleName: "superadmin", menuCode: "vendor", ...ALL },
  { roleName: "superadmin", menuCode: "platform", ...ALL },
  { roleName: "superadmin", menuCode: "purchase_request", ...ALL },
  { roleName: "superadmin", menuCode: "purchase_order", ...ALL },
  { roleName: "superadmin", menuCode: "user_warehouse_mapping", ...ALL },
  { roleName: "superadmin", menuCode: "inventory_mutations", ...VIEW_ONLY },
  { roleName: "superadmin", menuCode: "approval_step", ...ALL },

  // --- Admin ---
  { roleName: "admin", menuCode: "dashboard", ...ALL },
  { roleName: "admin", menuCode: "barang_masuk", ...ALL },
  { roleName: "admin", menuCode: "barang_keluar", ...ALL },
  { roleName: "admin", menuCode: "item", ...ALL },
  { roleName: "admin", menuCode: "gudang", ...ALL },
  { roleName: "admin", menuCode: "kategori", ...ALL },
  { roleName: "admin", menuCode: "uom", ...ALL },
  { roleName: "admin", menuCode: "user_management", ...ALL },
  { roleName: "admin", menuCode: "role_management", ...NONE },
  { roleName: "admin", menuCode: "menu_management", ...NONE },
  { roleName: "admin", menuCode: "permission_management", ...NONE },
  { roleName: "admin", menuCode: "activity_log", ...VIEW_ONLY },
  { roleName: "admin", menuCode: "customer", ...NONE },
  { roleName: "admin", menuCode: "vendor", ...NONE },
  { roleName: "admin", menuCode: "platform", ...NONE },
  { roleName: "admin", menuCode: "purchase_request", ...NONE },
  { roleName: "admin", menuCode: "purchase_order", ...NONE },
  { roleName: "admin", menuCode: "user_warehouse_mapping", ...ALL },
  { roleName: "admin", menuCode: "inventory_mutations", ...VIEW_ONLY },

  // --- Warehouse Head ---
  { roleName: "warehouse_head", menuCode: "dashboard", ...ALL },
  { roleName: "warehouse_head", menuCode: "barang_masuk", ...ALL },
  { roleName: "warehouse_head", menuCode: "barang_keluar", ...ALL },
  { roleName: "warehouse_head", menuCode: "item", ...ALL },
  { roleName: "warehouse_head", menuCode: "gudang", ...ALL },
  { roleName: "warehouse_head", menuCode: "kategori", ...API_ONLY },
  { roleName: "warehouse_head", menuCode: "uom", ...API_ONLY },
  { roleName: "warehouse_head", menuCode: "user_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "role_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "menu_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "permission_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "activity_log", ...NONE },
  { roleName: "warehouse_head", menuCode: "customer", ...API_ONLY },
  { roleName: "warehouse_head", menuCode: "vendor", ...API_ONLY },
  { roleName: "warehouse_head", menuCode: "platform", ...API_ONLY },
  { roleName: "warehouse_head", menuCode: "purchase_request", ...NONE },
  { roleName: "warehouse_head", menuCode: "purchase_order", ...NONE },
  { roleName: "warehouse_head", menuCode: "user_warehouse_mapping", ...NONE },
  { roleName: "warehouse_head", menuCode: "inventory_mutations", ...VIEW_ONLY },

  // --- Staff ---
  { roleName: "staff", menuCode: "dashboard", ...ALL },
  { roleName: "staff", menuCode: "barang_masuk", ...ALL },
  { roleName: "staff", menuCode: "barang_keluar", ...ALL },
  { roleName: "staff", menuCode: "item", ...API_ONLY },
  { roleName: "staff", menuCode: "gudang", ...API_ONLY },
  { roleName: "staff", menuCode: "kategori", ...API_ONLY },
  { roleName: "staff", menuCode: "uom", ...API_ONLY },
  { roleName: "staff", menuCode: "user_management", ...NONE },
  { roleName: "staff", menuCode: "role_management", ...NONE },
  { roleName: "staff", menuCode: "menu_management", ...NONE },
  { roleName: "staff", menuCode: "permission_management", ...NONE },
  { roleName: "staff", menuCode: "activity_log", ...NONE },
  { roleName: "staff", menuCode: "customer", ...API_ONLY },
  { roleName: "staff", menuCode: "vendor", ...API_ONLY },
  { roleName: "staff", menuCode: "platform", ...API_ONLY },
  { roleName: "staff", menuCode: "purchase_request", ...NONE },
  { roleName: "staff", menuCode: "purchase_order", ...NONE },
  { roleName: "staff", menuCode: "inventory_mutations", ...VIEW_ONLY },

  // --- User ---
  { roleName: "user", menuCode: "dashboard", ...ALL },
  { roleName: "user", menuCode: "barang_masuk", ...NONE },
  { roleName: "user", menuCode: "barang_keluar", ...NONE },
  { roleName: "user", menuCode: "item", ...API_ONLY },
  { roleName: "user", menuCode: "gudang", ...API_ONLY },
  { roleName: "user", menuCode: "kategori", ...API_ONLY },
  { roleName: "user", menuCode: "uom", ...API_ONLY },
  { roleName: "user", menuCode: "user_management", ...NONE },
  { roleName: "user", menuCode: "role_management", ...NONE },
  { roleName: "user", menuCode: "menu_management", ...NONE },
  { roleName: "user", menuCode: "permission_management", ...NONE },
  { roleName: "user", menuCode: "activity_log", ...NONE },
  { roleName: "user", menuCode: "customer", ...API_ONLY },
  { roleName: "user", menuCode: "vendor", ...API_ONLY },
  { roleName: "user", menuCode: "platform", ...API_ONLY },
  { roleName: "user", menuCode: "purchase_request", ...NONE },
  { roleName: "user", menuCode: "purchase_order", ...NONE },
  { roleName: "user", menuCode: "inventory_mutations", ...NONE },
];

export async function seedPermissions(
  roleIdMap: Record<string, string>,
  menuIdMap: Record<string, string>
): Promise<void> {
  console.log("🔑 Seeding role menu permissions...");

  for (const entry of DEFAULT_PERMISSIONS) {
    const roleId = roleIdMap[entry.roleName];
    const menuId = menuIdMap[entry.menuCode];

    if (!roleId || !menuId) {
      console.warn(`  ⚠ Skip: roleId/menuId not found for ${entry.roleName}/${entry.menuCode}`);
      continue;
    }

    const existing = await db
      .select({ id: roleMenuPermissions.id })
      .from(roleMenuPermissions)
      .where(
        and(
          eq(roleMenuPermissions.roleId, roleId),
          eq(roleMenuPermissions.menuId, menuId),
          isNull(roleMenuPermissions.deletedAt)
        )
      )
      .limit(1);

    if (existing[0]) {
      console.log(`  ✓ Permission ${entry.roleName}/${entry.menuCode} already exists`);
    } else {
      await db.insert(roleMenuPermissions).values({
        roleId,
        menuId,
        canView: entry.canView,
        canCreate: entry.canCreate,
        canUpdate: entry.canUpdate,
        canDelete: entry.canDelete,
      });
      console.log(`  + Permission ${entry.roleName}/${entry.menuCode} created`);
    }
  }
}
