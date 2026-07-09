import { pgTable, uuid, varchar, text, integer, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { purchaseOrders, purchaseOrderDetails } from "../purchase-order/purchase-order.schema";
import { vendors } from "../vendor/vendor.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { items } from "../item/item.schema";

export const goodsReceipts = pgTable("goods_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(), // e.g. GR-20260709-0001
  purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrders.id),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id),
  warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
  receiptDate: date("receipt_date").notNull(),
  deliveryNoteNumber: varchar("delivery_note_number", { length: 100 }), // Surat jalan vendor
  description: text("description"),
  status: integer("status").notNull().default(0), // 0: Draft, 1: Received / Pending QC
  ...auditColumns,
});

export const goodsReceiptDetails = pgTable("goods_receipt_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  goodsReceiptId: uuid("goods_receipt_id").notNull().references(() => goodsReceipts.id, { onDelete: "cascade" }),
  purchaseOrderDetailId: uuid("purchase_order_detail_id").notNull().references(() => purchaseOrderDetails.id),
  itemId: uuid("item_id").notNull().references(() => items.id),
  receivedQuantity: integer("received_quantity").notNull(), // kuantitas yang diterima fisik
  remark: text("remark"),
  ...auditColumns,
});

export const goodsReceiptRelations = relations(goodsReceipts, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [goodsReceipts.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  vendor: one(vendors, {
    fields: [goodsReceipts.vendorId],
    references: [vendors.id],
  }),
  warehouse: one(warehouses, {
    fields: [goodsReceipts.warehouseId],
    references: [warehouses.id],
  }),
  details: many(goodsReceiptDetails),
}));

export const goodsReceiptDetailsRelations = relations(goodsReceiptDetails, ({ one }) => ({
  goodsReceipt: one(goodsReceipts, {
    fields: [goodsReceiptDetails.goodsReceiptId],
    references: [goodsReceipts.id],
  }),
  purchaseOrderDetail: one(purchaseOrderDetails, {
    fields: [goodsReceiptDetails.purchaseOrderDetailId],
    references: [purchaseOrderDetails.id],
  }),
  item: one(items, {
    fields: [goodsReceiptDetails.itemId],
    references: [items.id],
  }),
}));
