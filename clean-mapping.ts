import { db } from './src/core/db/index.ts';
import { sql } from 'drizzle-orm';
await db.execute(sql`DELETE FROM user_warehouse_mappings WHERE user_id = '13f9c036-41a7-4b3a-aee5-4ccce0ed3417'`);
await db.execute(sql`DELETE FROM user_warehouse_roles WHERE user_id = '13f9c036-41a7-4b3a-aee5-4ccce0ed3417'`);
process.exit(0);
