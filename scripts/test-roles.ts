import { db } from "../src/core/db";
import { roles } from "../src/modules/role/role.schema";

async function run() {
  const data = await db.select().from(roles);
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}
run();
