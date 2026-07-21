import { pgTable, uuid, varchar, text, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { sql } from "drizzle-orm";

/**
 * Tabel: item_categories
 *
 * Menyimpan master data kategori barang.
 * Digunakan sebagai FK di tabel items.
 */
export const itemCategories = pgTable(
  "item_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex("idx_item_categories_code_active").on(t.code).where(sql`deleted_at IS NULL`),
    index("idx_item_categories_code").on(t.code),
    index("idx_item_categories_is_active").on(t.isActive),
    index("idx_item_categories_deleted_at").on(t.deletedAt),
  ]
);

export type ItemCategoryRecord = typeof itemCategories.$inferSelect;
export type ItemCategoryInsert = typeof itemCategories.$inferInsert;
