/**
 * Script untuk menambahkan permission "Mutasi Stok" ke semua role di database.
 * Jalankan dengan: bun run src/core/db/seeds/add-permission-mutations.ts
 */
import { db } from "../index";
import { menus } from "../../../modules/menu/menu.schema";
import { roleMenuPermissions } from "../../../modules/permission/permission.schema";
import { roles } from "../../../modules/role/role.schema";
import { eq, and, isNull } from "drizzle-orm";

const VIEW_ONLY = { canView: true, canCreate: false, canUpdate: false, canDelete: false };
const NONE = { canView: false, canCreate: false, canUpdate: false, canDelete: false };

const PERMISSION_MAP: Record<string, typeof VIEW_ONLY> = {
  superadmin: VIEW_ONLY,
  admin: VIEW_ONLY,
  manager: VIEW_ONLY,
  branch_head: VIEW_ONLY,
  warehouse_head: VIEW_ONLY,
  staff: VIEW_ONLY,
  user: NONE,
};

async function run() {
  // Cari menu inventory_mutations
  const menuRecord = await db.select({ id: menus.id }).from(menus).where(eq(menus.code, "inventory_mutations")).limit(1);
  if (!menuRecord[0]) {
    console.error("❌ Menu 'inventory_mutations' tidak ditemukan! Jalankan add-menu-mutations.ts terlebih dahulu.");
    process.exit(1);
  }
  const menuId = menuRecord[0].id;
  console.log("✓ Found menu inventory_mutations id:", menuId);

  for (const [roleName, perms] of Object.entries(PERMISSION_MAP)) {
    const roleRecord = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, roleName)).limit(1);
    if (!roleRecord[0]) {
      console.warn(`  ⚠ Role '${roleName}' tidak ditemukan, skip.`);
      continue;
    }
    const roleId = roleRecord[0].id;

    // Cek apakah sudah ada
    const existing = await db
      .select({ id: roleMenuPermissions.id })
      .from(roleMenuPermissions)
      .where(and(eq(roleMenuPermissions.roleId, roleId), eq(roleMenuPermissions.menuId, menuId), isNull(roleMenuPermissions.deletedAt)))
      .limit(1);

    if (existing[0]) {
      await db.update(roleMenuPermissions)
        .set({ ...perms, updatedAt: new Date() })
        .where(eq(roleMenuPermissions.id, existing[0].id));
      console.log(`  ✓ Permission ${roleName}/inventory_mutations updated.`);
    } else {
      await db.insert(roleMenuPermissions).values({ roleId, menuId, ...perms });
      console.log(`  + Permission ${roleName}/inventory_mutations created.`);
    }
  }

  console.log("\n✅ Selesai!");
  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
