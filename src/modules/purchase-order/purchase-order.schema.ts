import { pgTable, uuid, varchar, text, boolean, index, integer, date, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { vendors } from "../vendor/vendor.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { purchaseRequests } from "../purchase-request/purchase-request.schema";
import { items } from "../item/item.schema";

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(),
    purchaseRequestId: uuid("purchase_request_id").references(() => purchaseRequests.id),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    orderDate: date("order_date").notNull(),
    expectedDeliveryDate: date("expected_delivery_date"),
    status: integer("status").notNull().default(0), // 0=Draft, 1=Sent, 2=Partial Received, 3=Fully Received, 4=Cancelled
    totalPrice: decimal("total_price", { precision: 18, scale: 2 }).notNull().default("0"),
    tax: decimal("tax", { precision: 18, scale: 2 }).notNull().default("0"),
    discount: decimal("discount", { precision: 18, scale: 2 }).notNull().default("0"),
    shippingFee: decimal("shipping_fee", { precision: 18, scale: 2 }).notNull().default("0"),
    grandTotal: decimal("grand_total", { precision: 18, scale: 2 }).notNull().default("0"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_purchase_orders_code").on(t.code),
    index("idx_purchase_orders_vendor_id").on(t.vendorId),
    index("idx_purchase_orders_warehouse_id").on(t.warehouseId),
    index("idx_purchase_orders_status").on(t.status),
    index("idx_purchase_orders_deleted_at").on(t.deletedAt),
  ]
);

export const purchaseOrderDetails = pgTable(
  "purchase_order_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => items.id),
    quantity: integer("quantity").notNull(),
    receivedQuantity: integer("received_quantity").notNull().default(0),
    price: decimal("price", { precision: 18, scale: 2 }).notNull().default("0"),
    totalPrice: decimal("total_price", { precision: 18, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_po_details_po_id").on(t.purchaseOrderId),
    index("idx_po_details_item_id").on(t.itemId),
    index("idx_po_details_deleted_at").on(t.deletedAt),
  ]
);

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  purchaseRequest: one(purchaseRequests, {
    fields: [purchaseOrders.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
  vendor: one(vendors, {
    fields: [purchaseOrders.vendorId],
    references: [vendors.id],
  }),
  warehouse: one(warehouses, {
    fields: [purchaseOrders.warehouseId],
    references: [warehouses.id],
  }),
  details: many(purchaseOrderDetails),
}));

export const purchaseOrderDetailsRelations = relations(purchaseOrderDetails, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderDetails.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  item: one(items, {
    fields: [purchaseOrderDetails.itemId],
    references: [items.id],
  }),
}));

export type PurchaseOrderRecord = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderInsert = typeof purchaseOrders.$inferInsert;
export type PurchaseOrderDetailRecord = typeof purchaseOrderDetails.$inferSelect;
export type PurchaseOrderDetailInsert = typeof purchaseOrderDetails.$inferInsert;
