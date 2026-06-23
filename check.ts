import { db } from "./src/core/db";
import { warehouses } from "./src/modules/warehouse/warehouse.schema";
import { eq, isNull } from "drizzle-orm";

async function main() {
  const allW = await db.select().from(warehouses);
  console.log("All warehouses:", allW);
  
  const activeW = await db.select().from(warehouses).where(eq(warehouses.isActive, true));
  console.log("Active warehouses (isActive=true):", activeW);

  const activeAndNotDeleted = await db.select().from(warehouses).where(eq(warehouses.isActive, true)).where(isNull(warehouses.deletedAt));
  console.log("Active and not deleted:", activeAndNotDeleted);
  
  process.exit(0);
}

main();
