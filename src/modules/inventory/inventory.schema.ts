import {
  pgTable,
  uuid,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { warehouses } from "../warehouse/warehouse.schema";
import { items } from "../item/item.schema";

export const inventoryStocks = pgTable(
  "inventory_stocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull().default("0.00"),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex("unq_inventory_stocks_wh_item").on(t.warehouseId, t.itemId),
    index("idx_inventory_stocks_warehouse_id").on(t.warehouseId),
    index("idx_inventory_stocks_item_id").on(t.itemId),
  ]
);

export type InventoryStockRecord = typeof inventoryStocks.$inferSelect;
export type InventoryStockInsert = typeof inventoryStocks.$inferInsert;
