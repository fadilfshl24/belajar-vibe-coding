import { db } from './src/core/db';
import { roleMenuPermissions } from './src/modules/permission/permission.schema';
import { roles, userWarehouseRoles } from './src/modules/role/role.schema';
import { menus } from './src/modules/menu/menu.schema';
import { eq, inArray, and } from 'drizzle-orm';

async function main() {
  const r = await db.select().from(roles).where(inArray(roles.code, ['superadmin', 'admin', 'manager', 'warehouse_head', 'branch_head']));
  const m = await db.select().from(menus).where(inArray(menus.code, ['quotation_plan', 'history_price']));
  
  for(const role of r) {
    for(const menu of m) {
      const existing = await db.select().from(roleMenuPermissions).where(and(eq(roleMenuPermissions.roleId, role.id), eq(roleMenuPermissions.menuId, menu.id)));
      if(existing.length === 0) {
        await db.insert(roleMenuPermissions).values({
          roleId: role.id,
          menuId: menu.id,
          canView: true,
          canCreate: true,
          canUpdate: true,
          canDelete: true,
          canAccessApi: true
        });
      }
    }
  }
  console.log('patched');
  process.exit(0);
}
main();
