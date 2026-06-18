import type { IDatabaseAdapter } from "../adapter";
import { PostgresProvider } from "./postgres.provider";

/**
 * DB Provider Factory
 *
 * Membaca environment variable DB_DRIVER untuk menentukan provider mana yang
 * akan digunakan. Default: "postgres".
 *
 * Cara menambahkan provider baru (contoh: MySQL):
 * 1. Buat file `mysql.provider.ts` yang mengimplementasikan IDatabaseAdapter
 * 2. Import di sini dan tambahkan case "mysql" di bawah
 * 3. Set DB_DRIVER=mysql di .env
 *
 * Tidak perlu mengubah kode di modul-modul lain.
 */
export function getDbProvider(): IDatabaseAdapter {
  const driver = (process.env.DB_DRIVER ?? "postgres").toLowerCase();

  switch (driver) {
    case "postgres":
    case "postgresql":
      return new PostgresProvider();

    // Contoh template untuk menambahkan provider baru di masa depan:
    // case "mysql":
    //   return new MysqlProvider();
    // case "sqlite":
    //   return new SqliteProvider();

    default:
      throw new Error(
        `[DB Factory] Unsupported DB_DRIVER: "${driver}". ` +
          `Supported drivers: postgres. ` +
          `Please update DB_DRIVER in your .env file.`
      );
  }
}
