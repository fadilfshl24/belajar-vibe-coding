import { drizzle } from "drizzle-orm/postgres-js";
import { getDbProvider } from "./providers";

/**
 * Core Database Instance
 *
 * Ini adalah satu-satunya titik akses ke database di seluruh aplikasi.
 * Semua modul harus mengimpor `db` dari sini — bukan langsung dari provider.
 *
 * Untuk mengganti database: ubah DB_DRIVER di .env, tidak perlu ubah file ini.
 *
 * @example
 * import { db } from "@/core/db";
 * const users = await db.select().from(usersTable);
 */
const provider = getDbProvider();

export const db = provider.getClient() as ReturnType<typeof drizzle>;
