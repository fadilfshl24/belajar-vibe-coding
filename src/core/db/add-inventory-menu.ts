import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  try {
    // Check if inventory mutations menu exists
    const checkExists = await db.execute(sql`SELECT id FROM menus WHERE code = 'inventory_mutations'`);
    if (checkExists.length === 0) {
      await db.execute(sql`
        INSERT INTO menus (id, name, code, path, sort_order, icon, is_active) 
        VALUES (gen_random_uuid(), 'Inventory & Scrap', 'inventory_mutations', '/inventory', 7, 'layers', true)
      `);
      console.log("Inventory & Scrap menu added.");
    } else {
      console.log("Inventory & Scrap menu already exists.");
    }
    
    // Get menu ID
    const menu = await db.execute(sql`SELECT id FROM menus WHERE code = 'inventory_mutations' LIMIT 1`);
    const menuId = menu[0].id;

    // Roles to grant permissions
    const rolesToGrant = ['super_admin', 'warehouse_head', 'branch_head'];
    
    for (const roleCode of rolesToGrant) {
      const role = await db.execute(sql`SELECT id FROM roles WHERE code = ${roleCode} LIMIT 1`);
      if (role.length > 0) {
        const roleId = role[0].id;
        const p = await db.execute(sql`SELECT * FROM role_menu_permissions WHERE role_id = ${roleId} AND menu_id = ${menuId}`);
        if (p.length === 0) {
          await db.execute(sql`
            INSERT INTO role_menu_permissions (id, role_id, menu_id, can_view, can_create, can_update, can_delete, can_approve)
            VALUES (gen_random_uuid(), ${roleId}, ${menuId}, true, true, true, true, true)
          `);
          console.log(`Permissions for ${roleCode} added.`);
        } else {
          console.log(`Permissions for ${roleCode} already exists.`);
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();
