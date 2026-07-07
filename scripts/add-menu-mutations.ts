import { db } from './src/core/db/index';
import { menus } from './src/modules/menu/menu.schema';
import { eq } from 'drizzle-orm';

async function run() {
  // Cari parent 'transaksi'
  const parent = await db.select({ id: menus.id }).from(menus).where(eq(menus.code, 'transaksi')).limit(1);
  if (!parent[0]) { console.error('Parent transaksi not found!'); process.exit(1); }
  const parentId = parent[0].id;
  console.log('Found parent transaksi id:', parentId);

  // Cek apakah menu sudah ada
  const existing = await db.select({ id: menus.id }).from(menus).where(eq(menus.code, 'inventory_mutations')).limit(1);
  if (existing[0]) {
    await db.update(menus).set({ isActive: true, icon: 'activity', sortOrder: 5 }).where(eq(menus.id, existing[0].id));
    console.log('Menu inventory_mutations updated (already existed). id:', existing[0].id);
  } else {
    const inserted = await db.insert(menus).values({
      name: 'Mutasi Stok',
      code: 'inventory_mutations',
      path: '/inventory/mutations',
      sortOrder: 5,
      icon: 'activity',
      isActive: true,
      parentId,
    }).returning({ id: menus.id });
    console.log('Menu inventory_mutations inserted with id:', inserted[0]?.id);
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
