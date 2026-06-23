import { db } from "./src/core/db";
import { warehouses } from "./src/modules/warehouse/warehouse.schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const [activeWarehouses] = await db
    .select({ count: sql<number>`cast(count(${warehouses.id}) as int)` })
    .from(warehouses)
    .where(eq(warehouses.isActive, true));

  console.log("Count query result:", activeWarehouses);
  process.exit(0);
}

main();
