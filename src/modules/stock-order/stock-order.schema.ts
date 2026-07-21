import { pgTable, uuid, varchar, text, decimal, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { warehouses } from "../warehouse/warehouse.schema";
import { items } from "../item/item.schema";

export const stockOrders = pgTable(
  "stock_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseChannel: varchar("purchase_channel", { length: 50 }).notNull(), // TIKTOK, SHOPEE, LAZADA, TOKOPEDIA, LAINNYA
    trackingId: varchar("tracking_id", { length: 150 }).notNull(),
    orderId: varchar("order_id", { length: 150 }).notNull(),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull().default("UNPACKED"), // UNPACKED, PACKED, SENDING, DONE, RETURNED
    type: varchar("type", { length: 50 }).notNull().default("OUTBOUND"), // INBOUND, OUTBOUND
    paymentMethod: varchar("payment_method", { length: 100 }),
    shippingProviderName: varchar("shipping_provider_name", { length: 150 }),
    buyerUsername: varchar("buyer_username", { length: 150 }),
    recipient: varchar("recipient", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    address: text("address"),
    sellerNote: text("seller_note"),
    platformCreatedAt: timestamp("platform_created_at", { withTimezone: true }),
    platformPaidAt: timestamp("platform_paid_at", { withTimezone: true }),
    ...auditColumns,
  },
  (t) => [
    index("idx_stock_orders_tracking_id").on(t.trackingId),
    index("idx_stock_orders_order_id").on(t.orderId),
    index("idx_stock_orders_warehouse_id").on(t.warehouseId),
    index("idx_stock_orders_status").on(t.status),
    index("idx_stock_orders_type").on(t.type),
    index("idx_stock_orders_deleted_at").on(t.deletedAt),
  ]
);

export const stockOrderItems = pgTable(
  "stock_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockOrderId: uuid("stock_order_id").notNull().references(() => stockOrders.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    skuId: varchar("sku_id", { length: 150 }).notNull(),
    skuName: varchar("sku_name", { length: 255 }).notNull(),
    skuPrice: decimal("sku_price", { precision: 15, scale: 2 }),
    subtotalBeforeDiscount: decimal("subtotal_before_discount", { precision: 15, scale: 2 }),
    platformDiscount: decimal("platform_discount", { precision: 15, scale: 2 }),
    sellerDiscount: decimal("seller_discount", { precision: 15, scale: 2 }),
    subtotalAfterDiscount: decimal("subtotal_after_discount", { precision: 15, scale: 2 }),
    quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
    ...auditColumns,
  },
  (t) => [
    index("idx_stock_order_items_stock_order_id").on(t.stockOrderId),
    index("idx_stock_order_items_item_id").on(t.itemId),
    index("idx_stock_order_items_deleted_at").on(t.deletedAt),
  ]
);

export const stockOrdersRelations = relations(stockOrders, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [stockOrders.warehouseId],
    references: [warehouses.id],
  }),
  items: many(stockOrderItems),
}));

export const stockOrderItemsRelations = relations(stockOrderItems, ({ one }) => ({
  stockOrder: one(stockOrders, {
    fields: [stockOrderItems.stockOrderId],
    references: [stockOrders.id],
  }),
  item: one(items, {
    fields: [stockOrderItems.itemId],
    references: [items.id],
  }),
}));

export type StockOrderRecord = typeof stockOrders.$inferSelect;
export type StockOrderInsert = typeof stockOrders.$inferInsert;

export type StockOrderItemRecord = typeof stockOrderItems.$inferSelect;
export type StockOrderItemInsert = typeof stockOrderItems.$inferInsert;
