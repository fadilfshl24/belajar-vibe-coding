import { db } from "./index";
import { sql } from "drizzle-orm";
import * as fs from "fs";

async function main() {
  try {
    const query = fs.readFileSync("drizzle/0029_odd_terrax.sql", "utf8");
    await db.execute(sql.raw(query));
    console.log("Migration 0029 executed successfully");
  } catch (err) {
    console.error("Migration 0029 failed!", err);
  }
  process.exit(0);
}

main();
