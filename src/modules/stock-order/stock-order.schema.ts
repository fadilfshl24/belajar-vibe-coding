import {
  pgTable, uuid, varchar, text, decimal, timestamp,
  index, boolean
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { warehouses } from "../warehouse/warehouse.schema";
import { items } from "../item/item.schema";
import { users } from "../user/user.schema";

// ─────────────────────────────────────────────
// stock_orders
// ─────────────────────────────────────────────
export const stockOrders = pgTable(
  "stock_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseChannel: varchar("purchase_channel", { length: 50 }).notNull(), // TIKTOK, SHOPEE, LAZADA, TOKOPEDIA, LAINNYA
    trackingId: varchar("tracking_id", { length: 150 }).notNull(),
    orderId: varchar("order_id", { length: 150 }).notNull(),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull().default("UNPACKED"), // UNPACKED, PACKED, SENDING, DONE, RETURNED
    type: varchar("type", { length: 50 }).notNull().default("OUTBOUND"),     // INBOUND, OUTBOUND
    paymentMethod: varchar("payment_method", { length: 100 }),
    shippingProviderName: varchar("shipping_provider_name", { length: 150 }),
    buyerUsername: varchar("buyer_username", { length: 150 }),
    recipient: varchar("recipient", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    sellerNote: text("seller_note"),
    remark: text("remark"),                               // Catatan tambahan dari packer/petugas
    packedBy: uuid("packed_by").references(() => users.id, { onDelete: "set null" }),
    packedAt: timestamp("packed_at", { withTimezone: true }),
    returnedBy: uuid("returned_by").references(() => users.id, { onDelete: "set null" }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    platformCreatedAt: timestamp("platform_created_at", { withTimezone: true }),
    platformPaidAt: timestamp("platform_paid_at", { withTimezone: true }),
    platformRTSAt: timestamp("platform_rts_at", { withTimezone: true }),
    platformShippedAt: timestamp("platform_shipped_at", { withTimezone: true }),
    platformDeliveredAt: timestamp("platform_delivered_at", { withTimezone: true }),
    ...auditColumns,
  },
  (t) => [
    index("idx_stock_orders_tracking_id").on(t.trackingId),
    index("idx_stock_orders_order_id").on(t.orderId),
    index("idx_stock_orders_warehouse_id").on(t.warehouseId),
    index("idx_stock_orders_status").on(t.status),
    index("idx_stock_orders_type").on(t.type),
    index("idx_stock_orders_packed_by").on(t.packedBy),
    index("idx_stock_orders_returned_by").on(t.returnedBy),
    index("idx_stock_orders_deleted_at").on(t.deletedAt),
  ]
);

// ─────────────────────────────────────────────
// stock_order_items  (platform items, dari import excel)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// stock_order_item_mappings  (mapping fisik oleh packer saat outbound)
// ─────────────────────────────────────────────
export const stockOrderItemMappings = pgTable(
  "stock_order_item_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockOrderId: uuid("stock_order_id").notNull().references(() => stockOrders.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
    /** Jika true, stok akan dikembalikan otomatis saat item ini direturn */
    isAutoRestockIfReturn: boolean("is_auto_restock_if_return").notNull().default(false),
    ...auditColumns,
  },
  (t) => [
    index("idx_stock_order_item_mappings_order_id").on(t.stockOrderId),
    index("idx_stock_order_item_mappings_item_id").on(t.itemId),
    index("idx_stock_order_item_mappings_deleted_at").on(t.deletedAt),
  ]
);

// ─────────────────────────────────────────────
// stock_order_returns  (header penerimaan retur)
// ─────────────────────────────────────────────
export const stockOrderReturns = pgTable(
  "stock_order_returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockOrderId: uuid("stock_order_id").notNull().references(() => stockOrders.id, { onDelete: "cascade" }),
    returnReason: text("return_reason"),
    /** URL foto bukti retur – WAJIB diisi */
    proofImageUrl: text("proof_image_url").notNull(),
    returnedBy: uuid("returned_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    ...auditColumns,
  },
  (t) => [
    index("idx_stock_order_returns_order_id").on(t.stockOrderId),
    index("idx_stock_order_returns_returned_by").on(t.returnedBy),
    index("idx_stock_order_returns_deleted_at").on(t.deletedAt),
  ]
);

// ─────────────────────────────────────────────
// stock_order_return_items  (detail parsial item yang direturn)
// ─────────────────────────────────────────────
export const stockOrderReturnItems = pgTable(
  "stock_order_return_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockOrderReturnId: uuid("stock_order_return_id").notNull().references(() => stockOrderReturns.id, { onDelete: "cascade" }),
    /** Nullable – produk asing / bukan produk kita boleh item_id = null */
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    /** Nama snapshot produk (wajib isi, termasuk untuk produk asing) */
    itemNameSnapshot: varchar("item_name_snapshot", { length: 255 }).notNull(),
    returnedQuantity: decimal("returned_quantity", { precision: 15, scale: 2 }).notNull(),
    /** Apakah stok sudah dikembalikan ke inventory */
    isRestocked: boolean("is_restocked").notNull().default(false),
    notes: text("notes"),
    ...auditColumns,
  },
  (t) => [
    index("idx_stock_order_return_items_return_id").on(t.stockOrderReturnId),
    index("idx_stock_order_return_items_item_id").on(t.itemId),
    index("idx_stock_order_return_items_deleted_at").on(t.deletedAt),
  ]
);

// ─────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────
export const stockOrdersRelations = relations(stockOrders, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [stockOrders.warehouseId],
    references: [warehouses.id],
  }),
  packerUser: one(users, {
    fields: [stockOrders.packedBy],
    references: [users.id],
    relationName: "stockOrderPacker",
  }),
  returnerUser: one(users, {
    fields: [stockOrders.returnedBy],
    references: [users.id],
    relationName: "stockOrderReturner",
  }),
  platformItems: many(stockOrderItems),
  itemMappings: many(stockOrderItemMappings),
  returns: many(stockOrderReturns),
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

export const stockOrderItemMappingsRelations = relations(stockOrderItemMappings, ({ one }) => ({
  stockOrder: one(stockOrders, {
    fields: [stockOrderItemMappings.stockOrderId],
    references: [stockOrders.id],
  }),
  item: one(items, {
    fields: [stockOrderItemMappings.itemId],
    references: [items.id],
  }),
}));

export const stockOrderReturnsRelations = relations(stockOrderReturns, ({ one, many }) => ({
  stockOrder: one(stockOrders, {
    fields: [stockOrderReturns.stockOrderId],
    references: [stockOrders.id],
  }),
  returner: one(users, {
    fields: [stockOrderReturns.returnedBy],
    references: [users.id],
  }),
  returnItems: many(stockOrderReturnItems),
}));

export const stockOrderReturnItemsRelations = relations(stockOrderReturnItems, ({ one }) => ({
  stockOrderReturn: one(stockOrderReturns, {
    fields: [stockOrderReturnItems.stockOrderReturnId],
    references: [stockOrderReturns.id],
  }),
  item: one(items, {
    fields: [stockOrderReturnItems.itemId],
    references: [items.id],
  }),
}));

// ─────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────
export type StockOrderRecord = typeof stockOrders.$inferSelect;
export type StockOrderInsert = typeof stockOrders.$inferInsert;

export type StockOrderItemRecord = typeof stockOrderItems.$inferSelect;
export type StockOrderItemInsert = typeof stockOrderItems.$inferInsert;

export type StockOrderItemMappingRecord = typeof stockOrderItemMappings.$inferSelect;
export type StockOrderItemMappingInsert = typeof stockOrderItemMappings.$inferInsert;

export type StockOrderReturnRecord = typeof stockOrderReturns.$inferSelect;
export type StockOrderReturnInsert = typeof stockOrderReturns.$inferInsert;

export type StockOrderReturnItemRecord = typeof stockOrderReturnItems.$inferSelect;
export type StockOrderReturnItemInsert = typeof stockOrderReturnItems.$inferInsert;
