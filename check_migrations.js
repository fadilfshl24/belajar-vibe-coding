import postgres from "postgres";

const run = async () => {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const res = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 10`;
    console.log(res);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
};
run();
