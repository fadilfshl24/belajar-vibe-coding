import { defineConfig } from "drizzle-kit";

export default defineConfig({
  /**
   * Glob pattern untuk membaca schema dari semua modul secara otomatis.
   * Ketika menambahkan modul baru, cukup buat file *.schema.ts di dalam
   * folder modul — drizzle-kit akan otomatis mendeteksinya.
   */
  schema: "./src/modules/**/*.schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
