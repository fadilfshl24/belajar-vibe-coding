import { pgTable, uuid, varchar, text, boolean, index } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";

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
    code: varchar("code", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_item_categories_code").on(t.code),
    index("idx_item_categories_is_active").on(t.isActive),
    index("idx_item_categories_deleted_at").on(t.deletedAt),
  ]
);

export type ItemCategoryRecord = typeof itemCategories.$inferSelect;
export type ItemCategoryInsert = typeof itemCategories.$inferInsert;
