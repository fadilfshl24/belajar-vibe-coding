import { pgTable, uuid, varchar, text, boolean, index } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";

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
    code: varchar("code", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_uoms_code").on(t.code),
    index("idx_uoms_is_active").on(t.isActive),
    index("idx_uoms_deleted_at").on(t.deletedAt),
  ]
);

export type UomRecord = typeof uoms.$inferSelect;
export type UomInsert = typeof uoms.$inferInsert;
