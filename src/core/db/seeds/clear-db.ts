import { db } from "../index";
import { users } from "../../../modules/user/user.schema";
import { userWarehouseRoles } from "../../../modules/role/role.schema";
import { warehouses, warehouseHeads } from "../../../modules/warehouse/warehouse.schema";
import { uoms } from "../../../modules/uom/uom.schema";
import { itemCategories } from "../../../modules/category/category.schema";
import { items, itemPackageDetails } from "../../../modules/item/item.schema";
import { userSessions, userOauthAccounts } from "../../../modules/auth/auth.schema";
import { activityLogs } from "../../../modules/activity-log/activity-log.schema";
import { eq, ne } from "drizzle-orm";

async function main() {
  console.log("\n🧹 Cleaning up database (retaining superadmin and default config)...");

  try {
    // 1. Get the superadmin user ID
    const superadminUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "adminit@gmail.com"))
      .limit(1);

    const superadminId = superadminUser[0]?.id;
    if (!superadminId) {
      console.warn("⚠️ Superadmin user adminit@gmail.com not found!");
    }

    // 2. Clear activity logs
    console.log("  - Clearing activity logs...");
    await db.delete(activityLogs);

    // 3. Clear item package details & items
    console.log("  - Clearing item package details and items...");
    await db.delete(itemPackageDetails);
    await db.delete(items);

    // 4. Clear category & uom
    console.log("  - Clearing categories and uoms...");
    await db.delete(itemCategories);
    await db.delete(uoms);

    // 5. Clear sessions & oauth accounts except superadmin sessions
    console.log("  - Clearing user sessions and oauth accounts...");
    if (superadminId) {
      await db.delete(userSessions).where(ne(userSessions.userId, superadminId));
      await db.delete(userOauthAccounts).where(ne(userOauthAccounts.userId, superadminId));
    } else {
      await db.delete(userSessions);
      await db.delete(userOauthAccounts);
    }

    // 6. Clear warehouse heads
    console.log("  - Clearing warehouse heads...");
    await db.delete(warehouseHeads);

    // 7. Clear user warehouse roles mapping except superadmin mapping
    console.log("  - Clearing user warehouse roles...");
    if (superadminId) {
      await db.delete(userWarehouseRoles).where(ne(userWarehouseRoles.userId, superadminId));
    } else {
      await db.delete(userWarehouseRoles);
    }

    // 8. Clear warehouses except default WH-001
    console.log("  - Clearing warehouses except default WH-001...");
    await db.delete(warehouses).where(ne(warehouses.code, "WH-001"));

    // 9. Clear other users except superadmin
    console.log("  - Clearing all other users except superadmin...");
    if (superadminId) {
      await db.delete(users).where(ne(users.id, superadminId));
    } else {
      await db.delete(users);
    }

    console.log("\n✅ Database cleanup completed successfully!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Database cleanup failed:", error);
    process.exit(1);
  }
}

main();
