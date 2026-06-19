/**
 * Database Seeder — Entry Point
 *
 * Jalankan dengan: bun run db:seed
 *
 * Urutan eksekusi (harus berurutan karena ada dependency antar tabel):
 * 1. Roles   (independen)
 * 2. Menus   (independen)
 * 3. Superadmin User (independen)
 * 4. Role Menu Permissions (butuh roleIdMap + menuIdMap dari step 1 & 2)
 */

import { seedRoles } from "./roles.seed";
import { seedMenus } from "./menus.seed";
import { seedSuperadmin } from "./superadmin.seed";
import { seedPermissions } from "./permissions.seed";

async function main() {
  console.log("\n🌱 Starting database seeding...\n");

  try {
    const [roleIdMap, menuIdMap] = await Promise.all([
      seedRoles(),
      seedMenus(),
    ]);

    await seedSuperadmin(roleIdMap["superadmin"]!);

    await seedPermissions(roleIdMap, menuIdMap);

    console.log("\n✅ Database seeding completed successfully!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();
