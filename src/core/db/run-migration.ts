import { db } from "./index";
import { sql } from "drizzle-orm";
import * as fs from "fs";

async function main() {
  try {
    const query = fs.readFileSync("drizzle/0024_bizarre_wallop.sql", "utf8");
    await db.execute(sql.raw(query));
    console.log("Migration 0024 executed successfully");
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();
