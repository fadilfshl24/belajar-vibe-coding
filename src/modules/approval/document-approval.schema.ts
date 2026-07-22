import { pgTable, uuid, varchar, integer, boolean, index, timestamp, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { users } from "../user/user.schema";
import { purchaseRequests } from "../purchase-request/purchase-request.schema";
import { purchaseOrders } from "../purchase-order/purchase-order.schema";
import { quotationPlans } from "../quotation-plan/quotation-plan.schema";
import { qualityControls } from "../quality-control/quality-control.schema";

export const documentApprovals = pgTable(
  "document_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentType: varchar("document_type", { length: 20 }).notNull(), // 'PR', 'QP', 'PO', 'QC'
    documentId: uuid("document_id").notNull(),
    stage: integer("stage").notNull(),
    status: integer("status").notNull().default(0), // 0=Pending, 1=Approved, 2=Rejected
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    remark: text("remark"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_doc_approvals_doc_type").on(t.documentType),
    index("idx_doc_approvals_doc_id").on(t.documentId),
    index("idx_doc_approvals_approved_by").on(t.approvedBy),
    index("idx_doc_approvals_doc_type_id_stage").on(t.documentType, t.documentId, t.stage),
    index("idx_doc_approvals_deleted_at").on(t.deletedAt),
  ]
);

export type DocumentApprovalRecord = typeof documentApprovals.$inferSelect;
export type DocumentApprovalInsert = typeof documentApprovals.$inferInsert;

export const documentApprovalsRelations = relations(documentApprovals, ({ one }) => ({
  approver: one(users, {
    fields: [documentApprovals.approvedBy],
    references: [users.id],
  }),
  purchaseRequest: one(purchaseRequests, {
    fields: [documentApprovals.documentId],
    references: [purchaseRequests.id],
    relationName: "purchaseRequestApprovals",
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [documentApprovals.documentId],
    references: [purchaseOrders.id],
    relationName: "purchaseOrderApprovals",
  }),
  quotationPlan: one(quotationPlans, {
    fields: [documentApprovals.documentId],
    references: [quotationPlans.id],
    relationName: "quotationPlanApprovals",
  }),
  qualityControl: one(qualityControls, {
    fields: [documentApprovals.documentId],
    references: [qualityControls.id],
    relationName: "qualityControlApprovals",
  }),
}));
