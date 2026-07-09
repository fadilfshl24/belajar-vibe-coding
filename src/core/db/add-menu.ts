import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const checkPengadaan = await db.execute(sql`SELECT id FROM menus WHERE code = 'pengadaan' LIMIT 1`);
    const parentId = checkPengadaan[0]?.id || null;
    
    // Check if goods receipt menu exists
    const checkExists = await db.execute(sql`SELECT id FROM menus WHERE code = 'goods_receipt'`);
    if (checkExists.length === 0) {
      if (parentId) {
        await db.execute(sql`
          INSERT INTO menus (id, name, code, path, sort_order, icon, is_active, parent_id) 
          VALUES (gen_random_uuid(), 'Goods Receipt', 'goods_receipt', '/goods-receipts', 6, 'package', true, ${parentId})
        `);
      } else {
        await db.execute(sql`
          INSERT INTO menus (id, name, code, path, sort_order, icon, is_active) 
          VALUES (gen_random_uuid(), 'Goods Receipt', 'goods_receipt', '/goods-receipts', 6, 'package', true)
        `);
      }
      console.log("Goods Receipt menu added.");
    } else {
      console.log("Goods Receipt menu already exists.");
    }
    
    // Add permission role for super_admin
    const sa = await db.execute(sql`SELECT id FROM roles WHERE code = 'super_admin' LIMIT 1`);
    if (sa.length > 0) {
      const saId = sa[0].id;
      // Get menu ID
      const menu = await db.execute(sql`SELECT id FROM menus WHERE code = 'goods_receipt' LIMIT 1`);
      const menuId = menu[0].id;
      
      const p = await db.execute(sql`SELECT * FROM permissions WHERE role_id = ${saId} AND menu_id = ${menuId}`);
      if (p.length === 0) {
        await db.execute(sql`
          INSERT INTO permissions (id, role_id, menu_id, can_create, can_read, can_update, can_delete, can_approve)
          VALUES (gen_random_uuid(), ${saId}, ${menuId}, true, true, true, true, true)
        `);
        console.log("Permissions for super_admin added.");
      }
    }

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();
