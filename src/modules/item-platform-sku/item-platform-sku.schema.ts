import { pgTable, uuid, varchar, index } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { items } from "../item/item.schema";
import { platforms } from "../platform/platform.schema";

export const itemPlatformSkus = pgTable(
  "item_platform_skus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    platformId: uuid("platform_id")
      .notNull()
      .references(() => platforms.id),
    platformSku: varchar("platform_sku", { length: 100 }).notNull().unique(),
    ...auditColumns,
  },
  (t) => [
    index("idx_item_platform_skus_item_id").on(t.itemId),
    index("idx_item_platform_skus_platform_id").on(t.platformId),
    index("idx_item_platform_skus_platform_sku").on(t.platformSku),
    index("idx_item_platform_skus_deleted_at").on(t.deletedAt),
  ]
);

export type ItemPlatformSkuRecord = typeof itemPlatformSkus.$inferSelect;
export type ItemPlatformSkuInsert = typeof itemPlatformSkus.$inferInsert;

import { relations } from "drizzle-orm";

export const itemPlatformSkusRelations = relations(itemPlatformSkus, ({ one }) => ({
  item: one(items, {
    fields: [itemPlatformSkus.itemId],
    references: [items.id],
  }),
  platform: one(platforms, {
    fields: [itemPlatformSkus.platformId],
    references: [platforms.id],
  }),
}));
