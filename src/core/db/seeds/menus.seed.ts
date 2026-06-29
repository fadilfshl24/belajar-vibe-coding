import { db } from "../index";
import { menus } from "../../../modules/menu/menu.schema";
import { eq } from "drizzle-orm";

export const PARENT_MENUS = [
  { name: "Dashboard", code: "dashboard", path: "/", sortOrder: 1, icon: "layout-dashboard", isActive: true },
  { name: "Transaksi", code: "transaksi", path: "/transaksi", sortOrder: 2, icon: "arrow-up-right", isActive: true },
  { name: "Master Data", code: "master_data", path: "/master-data", sortOrder: 3, icon: "package", isActive: true },
  { name: "Administrasi", code: "administrasi", path: "/administrasi", sortOrder: 4, icon: "shield-check", isActive: true },
];

export const CHILD_MENUS: Record<string, any[]> = {
  transaksi: [
    { name: "Barang Masuk", code: "barang_masuk", path: "/stock-orders/inbound", sortOrder: 1, icon: "arrow-up-right", isActive: true },
    { name: "Barang Keluar", code: "barang_keluar", path: "/stock-orders/outbound", sortOrder: 2, icon: "arrow-down-right", isActive: true },
    { name: "Purchase Request", code: "purchase_request", path: "/purchase-requests", sortOrder: 3, icon: "file-text", isActive: true },
    { name: "Purchase Order", code: "purchase_order", path: "/purchase-orders", sortOrder: 4, icon: "shopping-cart", isActive: true },
  ],
  master_data: [
    { name: "Master Barang", code: "item", path: "/items", sortOrder: 1, icon: "package", isActive: true },
    { name: "Master Gudang", code: "gudang", path: "/warehouses", sortOrder: 2, icon: "warehouse", isActive: true },
    { name: "Kategori", code: "kategori", path: "/categories", sortOrder: 3, icon: "tags", isActive: true },
    { name: "Satuan (UOM)", code: "uom", path: "/uoms", sortOrder: 4, icon: "ruler", isActive: true },
    { name: "Customer", code: "customer", path: "/customers", sortOrder: 5, icon: "users", isActive: true },
    { name: "Vendor", code: "vendor", path: "/vendors", sortOrder: 6, icon: "truck", isActive: true },
    { name: "Platform", code: "platform", path: "/platforms", sortOrder: 7, icon: "globe", isActive: true },
  ],
  administrasi: [
    { name: "Manajemen User", code: "user_management", path: "/users", sortOrder: 1, icon: "users", isActive: true },
    { name: "Roles", code: "role_management", path: "/roles", sortOrder: 2, icon: "shield-check", isActive: true },
    { name: "Menus", code: "menu_management", path: "/menus", sortOrder: 3, icon: "menu", isActive: true },
    { name: "Permissions", code: "permission_management", path: "/permissions", sortOrder: 4, icon: "shield-check", isActive: true },
    { name: "Activity Logs", code: "activity_log", path: "/activity-logs", sortOrder: 5, icon: "activity", isActive: true },
  ],
};

export async function seedMenus(): Promise<Record<string, string>> {
  console.log("📋 Seeding menus...");
  const menuIdMap: Record<string, string> = {};

  // Seed Parents
  for (const menu of PARENT_MENUS) {
    const existing = await db.select({ id: menus.id }).from(menus).where(eq(menus.code, menu.code)).limit(1);
    if (existing[0]) {
      menuIdMap[menu.code] = existing[0].id;
      await db.update(menus).set({ icon: menu.icon, isActive: menu.isActive }).where(eq(menus.id, existing[0].id));
      console.log(`  ✓ Parent Menu "${menu.code}" updated/sync`);
    } else {
      const inserted = await db.insert(menus).values(menu).returning({ id: menus.id });
      menuIdMap[menu.code] = inserted[0]!.id;
      console.log(`  + Parent Menu "${menu.code}" created`);
    }
  }

  // Seed Children
  for (const parentCode of Object.keys(CHILD_MENUS)) {
    const parentId = menuIdMap[parentCode];
    if (!parentId) continue;

    for (const child of CHILD_MENUS[parentCode]) {
      const existing = await db.select({ id: menus.id }).from(menus).where(eq(menus.code, child.code)).limit(1);
      if (existing[0]) {
        menuIdMap[child.code] = existing[0].id;
        await db.update(menus).set({ icon: child.icon, isActive: child.isActive }).where(eq(menus.id, existing[0].id));
        console.log(`    ✓ Child Menu "${child.code}" updated/sync`);
      } else {
        const inserted = await db.insert(menus).values({ ...child, parentId }).returning({ id: menus.id });
        menuIdMap[child.code] = inserted[0]!.id;
        console.log(`    + Child Menu "${child.code}" created under "${parentCode}"`);
      }
    }
  }

  return menuIdMap;
}
