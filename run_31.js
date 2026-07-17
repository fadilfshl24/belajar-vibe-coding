import postgres from "postgres";
import fs from "fs";

const run = async () => {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const query = fs.readFileSync("drizzle/0031_abandoned_bromley.sql", "utf8");
    // Remove the comments/breakpoints
    const statements = query.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);
    
    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }
    console.log("Migration 0031 applied manually!");
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
};
run();
