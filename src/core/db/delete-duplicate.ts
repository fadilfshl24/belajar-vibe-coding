import { db } from "./index";
import { userWarehouseRoles } from "../../modules/role/role.schema";
import { eq } from "drizzle-orm";

async function main() {
  await db.delete(userWarehouseRoles).where(eq(userWarehouseRoles.id, "129a167a-042a-4d14-8c08-c45a7e5fb4bc"));
  console.log("Deleted Test Branch Head mapping.");
  process.exit(0);
}

main().catch(console.error);
