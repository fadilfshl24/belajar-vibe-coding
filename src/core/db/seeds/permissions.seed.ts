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
  { roleName: "superadmin", menuCode: "full_system_settings", ...ALL },
  { roleName: "superadmin", menuCode: "role_menu_management", ...ALL },
  { roleName: "superadmin", menuCode: "master_data", ...ALL },
  { roleName: "superadmin", menuCode: "configuration_app", ...ALL },
  { roleName: "superadmin", menuCode: "user_management", ...ALL },
  { roleName: "superadmin", menuCode: "warehouse_management", ...ALL },
  { roleName: "superadmin", menuCode: "inventory_management", ...ALL },
  { roleName: "superadmin", menuCode: "order_management", ...ALL },
  { roleName: "superadmin", menuCode: "activity_log", ...VIEW_ONLY },

  // --- Admin ---
  { roleName: "admin", menuCode: "full_system_settings", ...NONE },
  { roleName: "admin", menuCode: "role_menu_management", ...NONE },
  { roleName: "admin", menuCode: "master_data", ...ALL },
  { roleName: "admin", menuCode: "configuration_app", ...ALL },
  { roleName: "admin", menuCode: "user_management", ...ALL },
  { roleName: "admin", menuCode: "warehouse_management", ...ALL },
  { roleName: "admin", menuCode: "inventory_management", ...ALL },
  { roleName: "admin", menuCode: "order_management", ...ALL },
  { roleName: "admin", menuCode: "activity_log", ...VIEW_ONLY },

  // --- Warehouse Head ---
  { roleName: "warehouse_head", menuCode: "full_system_settings", ...NONE },
  { roleName: "warehouse_head", menuCode: "role_menu_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "master_data", ...NONE },
  { roleName: "warehouse_head", menuCode: "configuration_app", ...NONE },
  { roleName: "warehouse_head", menuCode: "user_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "warehouse_management", ...ALL },
  { roleName: "warehouse_head", menuCode: "inventory_management", ...ALL },
  { roleName: "warehouse_head", menuCode: "order_management", ...NONE },
  { roleName: "warehouse_head", menuCode: "activity_log", ...NONE },

  // --- Staff ---
  { roleName: "staff", menuCode: "full_system_settings", ...NONE },
  { roleName: "staff", menuCode: "role_menu_management", ...NONE },
  { roleName: "staff", menuCode: "master_data", ...NONE },
  { roleName: "staff", menuCode: "configuration_app", ...NONE },
  { roleName: "staff", menuCode: "user_management", ...NONE },
  { roleName: "staff", menuCode: "warehouse_management", ...NONE },
  { roleName: "staff", menuCode: "inventory_management", ...NONE },
  { roleName: "staff", menuCode: "order_management", ...ALL },
  { roleName: "staff", menuCode: "activity_log", ...NONE },

  // --- User ---
  { roleName: "user", menuCode: "full_system_settings", ...NONE },
  { roleName: "user", menuCode: "role_menu_management", ...NONE },
  { roleName: "user", menuCode: "master_data", ...NONE },
  { roleName: "user", menuCode: "configuration_app", ...NONE },
  { roleName: "user", menuCode: "user_management", ...NONE },
  { roleName: "user", menuCode: "warehouse_management", ...NONE },
  { roleName: "user", menuCode: "inventory_management", ...NONE },
  { roleName: "user", menuCode: "order_management", ...NONE },
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
