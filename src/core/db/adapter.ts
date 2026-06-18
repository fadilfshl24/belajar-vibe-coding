/**
 * IDatabaseAdapter
 *
 * Interface ini mendefinisikan kontrak yang harus dipenuhi oleh setiap
 * database provider (PostgreSQL, MySQL, SQLite, dll.).
 *
 * Tujuan: ketika ingin migrasi ke database yang berbeda, cukup tambahkan
 * provider baru yang mengimplementasikan interface ini, lalu ubah
 * DB_DRIVER di .env — tanpa mengubah kode modul lain sama sekali.
 */
export interface IDatabaseAdapter {
  /**
   * Mengembalikan instance Drizzle ORM yang sudah terhubung ke database.
   * Return type adalah `unknown` agar tidak terikat ke tipe spesifik Drizzle,
   * sehingga provider bisa bebas mengembalikan dialect-nya masing-masing.
   */
  getClient(): unknown;
}
