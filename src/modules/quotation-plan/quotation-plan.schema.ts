import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  boolean,
  decimal,
  index,
} from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { purchaseRequests, purchaseRequestDetails } from "../purchase-request/purchase-request.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { items } from "../item/item.schema";
import { vendors } from "../vendor/vendor.schema";
import { users } from "../user/user.schema";
import { relations } from "drizzle-orm";

export const quotationPlans = pgTable(
  "quotation_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull().unique(),
    status: integer("status").notNull().default(0), // 0 = Draft, 1 = Pending WH Head, 2 = Pending Branch Head, 3 = Approved, 4 = Rejected
    currentApprovalStage: integer("current_approval_stage").notNull().default(0), // 0=WH_HEAD, 1=BRANCH_HEAD
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_quotation_plans_wh_id").on(t.warehouseId),
    index("idx_quotation_plans_status").on(t.status),
    index("idx_quotation_plans_deleted_at").on(t.deletedAt),
  ]
);

export const quotationPlanDetails = pgTable(
  "quotation_plan_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationPlanId: uuid("quotation_plan_id").notNull().references(() => quotationPlans.id, { onDelete: "cascade" }),
    purchaseRequestDetailId: uuid("purchase_request_detail_id").notNull(),
    itemId: uuid("item_id").notNull().references(() => items.id),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id),
    requestedQuantity: integer("requested_quantity").notNull(),
    offeredQuantity: integer("offered_quantity").notNull(),
    price: decimal("price", { precision: 18, scale: 2 }).notNull().default("0"),
    totalPrice: decimal("total_price", { precision: 18, scale: 2 }).notNull().default("0"),
    remark: text("remark"),
    attachmentUrl: varchar("attachment_url", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_qp_details_qp_id").on(t.quotationPlanId),
    index("idx_qp_details_item_id").on(t.itemId),
    index("idx_qp_details_vendor_id").on(t.vendorId),
    index("idx_qp_details_deleted_at").on(t.deletedAt),
  ]
);

import { documentApprovals } from "../approval/document-approval.schema";

export const quotationPlanPurchaseRequests = pgTable(
  "quotation_plan_purchase_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationPlanId: uuid("quotation_plan_id").notNull().references(() => quotationPlans.id, { onDelete: "cascade" }),
    purchaseRequestId: uuid("purchase_request_id").notNull().references(() => purchaseRequests.id, { onDelete: "cascade" }),
    ...auditColumns,
  },
  (t) => [
    index("idx_qp_pr_qp_id").on(t.quotationPlanId),
    index("idx_qp_pr_pr_id").on(t.purchaseRequestId),
  ]
);

export type QuotationPlanRecord = typeof quotationPlans.$inferSelect;
export type QuotationPlanDetailRecord = typeof quotationPlanDetails.$inferSelect;
export type QuotationPlanPurchaseRequestRecord = typeof quotationPlanPurchaseRequests.$inferSelect;

export const quotationPlansRelations = relations(quotationPlans, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [quotationPlans.warehouseId],
    references: [warehouses.id],
  }),
  requester: one(users, {
    fields: [quotationPlans.createdBy],
    references: [users.id],
  }),
  details: many(quotationPlanDetails),
  approvals: many(documentApprovals, {
    relationName: "quotationPlanApprovals",
  }),
  purchaseRequests: many(quotationPlanPurchaseRequests),
}));

export const quotationPlanPurchaseRequestsRelations = relations(quotationPlanPurchaseRequests, ({ one }) => ({
  quotationPlan: one(quotationPlans, {
    fields: [quotationPlanPurchaseRequests.quotationPlanId],
    references: [quotationPlans.id],
  }),
  purchaseRequest: one(purchaseRequests, {
    fields: [quotationPlanPurchaseRequests.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
}));

export const quotationPlanDetailsRelations = relations(quotationPlanDetails, ({ one }) => ({
  quotationPlan: one(quotationPlans, {
    fields: [quotationPlanDetails.quotationPlanId],
    references: [quotationPlans.id],
  }),
  item: one(items, {
    fields: [quotationPlanDetails.itemId],
    references: [items.id],
  }),
  vendor: one(vendors, {
    fields: [quotationPlanDetails.vendorId],
    references: [vendors.id],
  }),
  purchaseRequestDetail: one(purchaseRequestDetails, {
    fields: [quotationPlanDetails.purchaseRequestDetailId],
    references: [purchaseRequestDetails.id],
  }),
}));

