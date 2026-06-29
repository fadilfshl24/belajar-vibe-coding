import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { IDatabaseAdapter } from "../adapter";

/**
 * PostgresProvider
 *
 * Implementasi IDatabaseAdapter menggunakan driver PostgreSQL (postgres.js + Drizzle).
 * Untuk mengganti ke database lain (MySQL, SQLite, dll.), cukup buat provider baru
 * dengan pola yang sama dan daftarkan di `providers/index.ts`.
 *
 * Konfigurasi via environment variable:
 * - DATABASE_URL: PostgreSQL connection string (wajib)
 */
import * as schema from "../schema";

export class PostgresProvider implements IDatabaseAdapter {
  private client: ReturnType<typeof drizzle>;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "[PostgresProvider] Environment variable DATABASE_URL is not set. " +
          "Please add it to your .env file."
      );
    }

    const pgClient = postgres(connectionString);
    this.client = drizzle(pgClient, { schema });
  }

  getClient(): ReturnType<typeof drizzle> {
    return this.client;
  }
}
