import { pgTable, uuid, varchar, text, boolean, index, integer, date, decimal, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { vendors } from "../vendor/vendor.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { purchaseRequests } from "../purchase-request/purchase-request.schema";
import { items } from "../item/item.schema";
import { users } from "../user/user.schema";

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(),
    quotationPlanId: uuid("quotation_plan_id"),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    orderDate: date("order_date").notNull(),
    expectedDeliveryDate: date("expected_delivery_date"),
    status: integer("status").notNull().default(0), // 0 = Draft, 1 = Pending Approval, 2 = Approved, 3 = Rejected, 4 = Sent, 5 = Partial Received, 6 = Fully Received, 7 = Cancelled
    currentApprovalStage: integer("current_approval_stage").notNull().default(0), // 0 = WH_HEAD, 1 = BRANCH_HEAD, 2 = MANAGER, 3 = DONE
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    totalPrice: decimal("total_price", { precision: 18, scale: 2 }).notNull().default("0"),
    tax: decimal("tax", { precision: 18, scale: 2 }).notNull().default("0"),
    discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
    discount: decimal("discount", { precision: 18, scale: 2 }).notNull().default("0"),
    shippingFee: decimal("shipping_fee", { precision: 18, scale: 2 }).notNull().default("0"),
    grandTotal: decimal("grand_total", { precision: 18, scale: 2 }).notNull().default("0"),
    description: text("description"),
    termsConditions: text("terms_conditions"),
    termOfPayment: varchar("term_of_payment", { length: 255 }),
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
    purchaseRequestDetailId: uuid("purchase_request_detail_id"), // traceability to source PR detail
    quotationPlanDetailId: uuid("quotation_plan_detail_id"), // traceability to source QP detail
    itemId: uuid("item_id").notNull().references(() => items.id),
    quantity: integer("quantity").notNull(),
    receivedQuantity: integer("received_quantity").notNull().default(0),
    price: decimal("price", { precision: 18, scale: 2 }).notNull().default("0"),
    totalPrice: decimal("total_price", { precision: 18, scale: 2 }).notNull().default("0"),
    remark: text("remark"),
    attachmentUrl: varchar("attachment_url", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_po_details_po_id").on(t.purchaseOrderId),
    index("idx_po_details_item_id").on(t.itemId),
    index("idx_po_details_deleted_at").on(t.deletedAt),
  ]
);

// Pivot table: Many-to-Many between PO and PR (Multi-PR support)
export const purchaseOrderRequests = pgTable(
  "purchase_order_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
    purchaseRequestId: uuid("purchase_request_id").notNull().references(() => purchaseRequests.id),
    ...auditColumns,
  },
  (t) => [
    index("idx_por_po_id").on(t.purchaseOrderId),
    index("idx_por_pr_id").on(t.purchaseRequestId),
  ]
);

// Approval trail for PO: WH Head → Branch Head → Manager
export const purchaseOrderApprovals = pgTable(
  "purchase_order_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
    stage: integer("stage").notNull(), // 0=WH_HEAD, 1=BRANCH_HEAD, 2=MANAGER
    status: integer("status").notNull().default(0), // 0=Pending, 1=Approved, 2=Rejected
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    remark: text("remark"),
    ...auditColumns,
  },
  (t) => [
    index("idx_poa_po_id").on(t.purchaseOrderId),
    index("idx_poa_stage").on(t.stage),
    index("idx_poa_status").on(t.status),
  ]
);

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  quotationPlan: one(require("../quotation-plan/quotation-plan.schema").quotationPlans, {
    fields: [purchaseOrders.quotationPlanId],
    references: [require("../quotation-plan/quotation-plan.schema").quotationPlans.id],
  }),
  vendor: one(vendors, {
    fields: [purchaseOrders.vendorId],
    references: [vendors.id],
  }),
  warehouse: one(warehouses, {
    fields: [purchaseOrders.warehouseId],
    references: [warehouses.id],
  }),
  approvedByUser: one(users, {
    fields: [purchaseOrders.approvedBy],
    references: [users.id],
  }),
  details: many(purchaseOrderDetails),
  purchaseRequests: many(purchaseOrderRequests),
  approvals: many(purchaseOrderApprovals),
}));

export const purchaseOrderDetailsRelations = relations(purchaseOrderDetails, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderDetails.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  quotationPlanDetail: one(require("../quotation-plan/quotation-plan.schema").quotationPlanDetails, {
    fields: [purchaseOrderDetails.quotationPlanDetailId],
    references: [require("../quotation-plan/quotation-plan.schema").quotationPlanDetails.id],
  }),
  item: one(items, {
    fields: [purchaseOrderDetails.itemId],
    references: [items.id],
  }),
}));

export const purchaseOrderRequestsRelations = relations(purchaseOrderRequests, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderRequests.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  purchaseRequest: one(purchaseRequests, {
    fields: [purchaseOrderRequests.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
}));

export const purchaseOrderApprovalsRelations = relations(purchaseOrderApprovals, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderApprovals.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  approver: one(users, {
    fields: [purchaseOrderApprovals.approvedBy],
    references: [users.id],
  }),
}));

export type PurchaseOrderRecord = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderInsert = typeof purchaseOrders.$inferInsert;
export type PurchaseOrderDetailRecord = typeof purchaseOrderDetails.$inferSelect;
export type PurchaseOrderDetailInsert = typeof purchaseOrderDetails.$inferInsert;
export type PurchaseOrderRequestRecord = typeof purchaseOrderRequests.$inferSelect;
export type PurchaseOrderApprovalRecord = typeof purchaseOrderApprovals.$inferSelect;
