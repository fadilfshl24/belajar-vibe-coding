import { pgTable, uuid, varchar, index, integer } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";

/**
 * Tabel: menus
 *
 * Menyimpan daftar menu / fitur yang tersedia di aplikasi.
 *
 * - parentId : ID menu parent (hierarki). Null = parent teratas.
 * - name : Nama tampilan menu (e.g., "Master Data")
 * - code : Identifier unik untuk dipakai di backend/frontend (e.g., "master_data")
 * - path : URL path menu (e.g., "/master-data")
 * - sortOrder: Urutan penampilan menu.
 */
export const menus = pgTable(
  "menus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => menus.id),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 255 }).notNull().unique(),
    path: varchar("path", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_menus_code").on(t.code),
    index("idx_menus_deleted_at").on(t.deletedAt),
  ]
);

export type MenuRecord = typeof menus.$inferSelect;
export type MenuInsert = typeof menus.$inferInsert;
