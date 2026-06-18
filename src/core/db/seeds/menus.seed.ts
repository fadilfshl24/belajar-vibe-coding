import { db } from "../index";
import { menus } from "../../../modules/menu/menu.schema";
import { eq } from "drizzle-orm";

/**
 * Seed: Menus
 *
 * Membuat 9 menu default sesuai kebutuhan WMS.
 * Bersifat idempotent — tidak akan insert duplikat jika sudah ada.
 */
export const MENUS = [
  { name: "Full System Settings", code: "full_system_settings", path: "/system-settings" },
  { name: "Role Menu Management", code: "role_menu_management", path: "/role-menu-management" },
  { name: "Master Data", code: "master_data", path: "/master-data" },
  { name: "Configuration App", code: "configuration_app", path: "/configuration" },
  { name: "User Management", code: "user_management", path: "/users" },
  { name: "Warehouse Management", code: "warehouse_management", path: "/warehouses" },
  { name: "Inventory Management", code: "inventory_management", path: "/inventory" },
  { name: "Order Management", code: "order_management", path: "/orders" },
  { name: "Activity Log / Monitor", code: "activity_log", path: "/activity-logs" },
] as const;

export async function seedMenus(): Promise<Record<string, string>> {
  console.log("📋 Seeding menus...");
  const menuIdMap: Record<string, string> = {};

  for (const menu of MENUS) {
    const existing = await db
      .select({ id: menus.id })
      .from(menus)
      .where(eq(menus.code, menu.code))
      .limit(1);

    if (existing[0]) {
      menuIdMap[menu.code] = existing[0].id;
      console.log(`  ✓ Menu "${menu.code}" already exists`);
    } else {
      const inserted = await db.insert(menus).values(menu).returning({ id: menus.id });
      menuIdMap[menu.code] = inserted[0]!.id;
      console.log(`  + Menu "${menu.code}" created`);
    }
  }

  return menuIdMap;
}
