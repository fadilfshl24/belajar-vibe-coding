import { uuid, timestamp } from "drizzle-orm/pg-core";

/**
 * auditColumns
 *
 * Kolom audit standar yang wajib ada di setiap tabel sesuai requirement WMS.
 * Spread object ini ke dalam definisi pgTable() untuk konsistensi.
 *
 * Kolom yang dihasilkan:
 * - created_at  : Tanggal data dibuat (auto)
 * - updated_at  : Tanggal data terakhir diubah
 * - deleted_at  : Tanggal soft delete (null = data aktif)
 * - created_by  : UUID user yang membuat data
 * - updated_by  : UUID user yang terakhir mengubah data
 *
 * @example
 * export const myTable = pgTable("my_table", {
 *   id: uuid("id").primaryKey().defaultRandom(),
 *   name: varchar("name", { length: 255 }).notNull(),
 *   ...auditColumns,
 * });
 */
export const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};
