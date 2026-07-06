/**
 * Script untuk menambahkan menu "Mutasi Stok" ke database.
 * Jalankan dengan: bun run src/core/db/seeds/add-menu-mutations.ts
 */
import { db } from "../index";
import { menus } from "../../../modules/menu/menu.schema";
import { eq } from "drizzle-orm";

async function run() {
  // Cari parent 'transaksi'
  const parent = await db.select({ id: menus.id }).from(menus).where(eq(menus.code, "transaksi")).limit(1);
  if (!parent[0]) {
    console.error("❌ Parent menu 'transaksi' tidak ditemukan!");
    process.exit(1);
  }
  const parentId = parent[0].id;
  console.log("✓ Found parent transaksi id:", parentId);

  // Cek apakah menu sudah ada
  const existing = await db.select({ id: menus.id }).from(menus).where(eq(menus.code, "inventory_mutations")).limit(1);
  if (existing[0]) {
    await db.update(menus).set({ isActive: true, icon: "activity", sortOrder: 5, name: "Mutasi Stok" }).where(eq(menus.id, existing[0].id));
    console.log("✓ Menu 'inventory_mutations' sudah ada — di-update.");
  } else {
    const inserted = await db.insert(menus).values({
      name: "Mutasi Stok",
      code: "inventory_mutations",
      path: "/inventory/mutations",
      sortOrder: 5,
      icon: "activity",
      isActive: true,
      parentId,
    }).returning({ id: menus.id });
    console.log("✅ Menu 'inventory_mutations' berhasil dibuat dengan id:", inserted[0]?.id);
  }

  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
