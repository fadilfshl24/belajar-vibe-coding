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
};

const ALL = { canView: true, canCreate: true, canUpdate: true, canDelete: true };
const VIEW_ONLY = { canView: true, canCreate: false, canUpdate: false, canDelete: false };
const NONE = { canView: false, canCreate: false, canUpdate: false, canDelete: false };

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

  // --- Warehouse Head ---
  { roleName: "warehouse_head", menuCode: "dashboard", ...ALL },
  { roleName: "warehouse_head", menuCode: "barang_masuk", ...ALL },
  { roleName: "warehouse_head", menuCode: "barang_keluar", ...ALL },
  { roleName: "warehouse_head", menuCode: "item", ...ALL },
  { roleName: "warehouse_head", menuCode: "gudang", ...ALL },
  { roleName: "warehouse_head", menuCode: "kategori", ...NONE },
  { roleName: "warehouse_head", menuCode: "uom", ...NONE },
  { roleName: "warehouse_head", menuCode: "user_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "role_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "menu_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "permission_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "activity_log", ...NONE },

  // --- Staff ---
  { roleName: "staff", menuCode: "dashboard", ...ALL },
  { roleName: "staff", menuCode: "barang_masuk", ...ALL },
  { roleName: "staff", menuCode: "barang_keluar", ...ALL },
  { roleName: "staff", menuCode: "item", ...NONE },
  { roleName: "staff", menuCode: "gudang", ...NONE },
  { roleName: "staff", menuCode: "kategori", ...NONE },
  { roleName: "staff", menuCode: "uom", ...NONE },
  { roleName: "staff", menuCode: "user_management", ...NONE },
  { roleName: "staff", menuCode: "role_management", ...NONE },
  { roleName: "staff", menuCode: "menu_management", ...NONE },
  { roleName: "staff", menuCode: "permission_management", ...NONE },
  { roleName: "staff", menuCode: "activity_log", ...NONE },

  // --- User ---
  { roleName: "user", menuCode: "dashboard", ...ALL },
  { roleName: "user", menuCode: "barang_masuk", ...NONE },
  { roleName: "user", menuCode: "barang_keluar", ...NONE },
  { roleName: "user", menuCode: "item", ...NONE },
  { roleName: "user", menuCode: "gudang", ...NONE },
  { roleName: "user", menuCode: "kategori", ...NONE },
  { roleName: "user", menuCode: "uom", ...NONE },
  { roleName: "user", menuCode: "user_management", ...NONE },
  { roleName: "user", menuCode: "role_management", ...NONE },
  { roleName: "user", menuCode: "menu_management", ...NONE },
  { roleName: "user", menuCode: "permission_management", ...NONE },
  { roleName: "user", menuCode: "activity_log", ...NONE },
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
