import { pgTable, uuid, varchar, text, boolean, index, integer, timestamp, date, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { customers } from "../customer/customer.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { users } from "../user/user.schema";
import { items } from "../item/item.schema";

export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(),
    requestDate: date("request_date").notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    description: text("description"),
    status: integer("status").notNull().default(0), // 0=Draft, 1=Pending, 2=Approved, 3=Rejected, 4=Closed
    requestedBy: uuid("requested_by").notNull().references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_purchase_requests_code").on(t.code),
    index("idx_purchase_requests_warehouse_id").on(t.warehouseId),
    index("idx_purchase_requests_status").on(t.status),
    index("idx_purchase_requests_deleted_at").on(t.deletedAt),
  ]
);

export const purchaseRequestDetails = pgTable(
  "purchase_request_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseRequestId: uuid("purchase_request_id").notNull().references(() => purchaseRequests.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => items.id),
    quantity: integer("quantity").notNull(),
    price: decimal("price", { precision: 18, scale: 2 }).notNull().default("0"),
    totalPrice: decimal("total_price", { precision: 18, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_pr_details_pr_id").on(t.purchaseRequestId),
    index("idx_pr_details_item_id").on(t.itemId),
    index("idx_pr_details_deleted_at").on(t.deletedAt),
  ]
);

export const purchaseRequestsRelations = relations(purchaseRequests, ({ one, many }) => ({
  customer: one(customers, {
    fields: [purchaseRequests.customerId],
    references: [customers.id],
  }),
  warehouse: one(warehouses, {
    fields: [purchaseRequests.warehouseId],
    references: [warehouses.id],
  }),
  requester: one(users, {
    fields: [purchaseRequests.requestedBy],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [purchaseRequests.approvedBy],
    references: [users.id],
  }),
  details: many(purchaseRequestDetails),
}));

export const purchaseRequestDetailsRelations = relations(purchaseRequestDetails, ({ one }) => ({
  purchaseRequest: one(purchaseRequests, {
    fields: [purchaseRequestDetails.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
  item: one(items, {
    fields: [purchaseRequestDetails.itemId],
    references: [items.id],
  }),
}));

export type PurchaseRequestRecord = typeof purchaseRequests.$inferSelect;
export type PurchaseRequestInsert = typeof purchaseRequests.$inferInsert;
export type PurchaseRequestDetailRecord = typeof purchaseRequestDetails.$inferSelect;
export type PurchaseRequestDetailInsert = typeof purchaseRequestDetails.$inferInsert;
