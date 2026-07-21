import { pgTable, uuid, varchar, text, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { sql } from "drizzle-orm";

/**
 * Tabel: uoms
 *
 * Menyimpan master data satuan ukur barang (Unit of Measurement).
 * Contoh: PCS, KG, LITER, BOX, LUSIN, KARTON.
 * Digunakan sebagai FK di tabel items.
 */
export const uoms = pgTable(
  "uoms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex("idx_uoms_code_active").on(t.code).where(sql`deleted_at IS NULL`),
    index("idx_uoms_code").on(t.code),
    index("idx_uoms_is_active").on(t.isActive),
    index("idx_uoms_deleted_at").on(t.deletedAt),
  ]
);

export type UomRecord = typeof uoms.$inferSelect;
export type UomInsert = typeof uoms.$inferInsert;
