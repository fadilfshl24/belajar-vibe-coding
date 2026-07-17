import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const runMigrate = async () => {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  console.log("Running migrations...");

  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migrations complete!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await sql.end();
  }
};

runMigrate();
