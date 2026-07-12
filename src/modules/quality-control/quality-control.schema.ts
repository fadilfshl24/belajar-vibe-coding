import { pgTable, uuid, varchar, text, integer, date, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { goodsReceipts, goodsReceiptDetails } from "../goods-receipt/goods-receipt.schema";
import { users } from "../user/user.schema";
import { items } from "../item/item.schema";

export const qualityControls = pgTable(
  "quality_controls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(), // e.g. QC-20260709-0001
    goodsReceiptId: uuid("goods_receipt_id").notNull().references(() => goodsReceipts.id),
    inspectionDate: date("inspection_date").notNull(),
    status: integer("status").notNull().default(0), // 0: Draft, 1: Pending Approval, 2: Approved, 3: Rejected
    currentApprovalStage: integer("current_approval_stage").notNull().default(0), // Track approval level
    inspectorId: uuid("inspector_id").notNull().references(() => users.id),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_quality_controls_code").on(t.code),
    index("idx_quality_controls_gr_id").on(t.goodsReceiptId),
    index("idx_quality_controls_status").on(t.status),
    index("idx_quality_controls_deleted_at").on(t.deletedAt),
  ]
);

export const qualityControlDetails = pgTable(
  "quality_control_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    qualityControlId: uuid("quality_control_id")
      .notNull()
      .references(() => qualityControls.id, { onDelete: "cascade" }),
    goodsReceiptDetailId: uuid("goods_receipt_detail_id")
      .notNull()
      .references(() => goodsReceiptDetails.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    passQuantity: integer("pass_quantity").notNull().default(0),
    rejectQuantity: integer("reject_quantity").notNull().default(0),
    rejectReason: text("reject_reason"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_qc_details_qc_id").on(t.qualityControlId),
    index("idx_qc_details_item_id").on(t.itemId),
    index("idx_qc_details_deleted_at").on(t.deletedAt),
  ]
);

export const qualityControlApprovals = pgTable(
  "quality_control_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    qualityControlId: uuid("quality_control_id")
      .notNull()
      .references(() => qualityControls.id, { onDelete: "cascade" }),
    stage: integer("stage").notNull(),
    status: integer("status").notNull().default(0), // 0=Pending, 1=Approved, 2=Rejected
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    remark: text("remark"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_qc_approvals_qc_id").on(t.qualityControlId),
    index("idx_qc_approvals_approved_by").on(t.approvedBy),
    index("idx_qc_approvals_qc_id_stage").on(t.qualityControlId, t.stage),
    index("idx_qc_approvals_deleted_at").on(t.deletedAt),
  ]
);

export const qualityControlsRelations = relations(qualityControls, ({ one, many }) => ({
  goodsReceipt: one(goodsReceipts, {
    fields: [qualityControls.goodsReceiptId],
    references: [goodsReceipts.id],
  }),
  inspector: one(users, {
    fields: [qualityControls.inspectorId],
    references: [users.id],
  }),
  details: many(qualityControlDetails),
  approvals: many(qualityControlApprovals),
}));

export const qualityControlDetailsRelations = relations(qualityControlDetails, ({ one }) => ({
  qualityControl: one(qualityControls, {
    fields: [qualityControlDetails.qualityControlId],
    references: [qualityControls.id],
  }),
  goodsReceiptDetail: one(goodsReceiptDetails, {
    fields: [qualityControlDetails.goodsReceiptDetailId],
    references: [goodsReceiptDetails.id],
  }),
  item: one(items, {
    fields: [qualityControlDetails.itemId],
    references: [items.id],
  }),
}));

export const qualityControlApprovalsRelations = relations(qualityControlApprovals, ({ one }) => ({
  qualityControl: one(qualityControls, {
    fields: [qualityControlApprovals.qualityControlId],
    references: [qualityControls.id],
  }),
  approver: one(users, {
    fields: [qualityControlApprovals.approvedBy],
    references: [users.id],
  }),
}));

export type QualityControlRecord = typeof qualityControls.$inferSelect;
export type QualityControlInsert = typeof qualityControls.$inferInsert;
export type QualityControlDetailRecord = typeof qualityControlDetails.$inferSelect;
export type QualityControlDetailInsert = typeof qualityControlDetails.$inferInsert;
export type QualityControlApprovalRecord = typeof qualityControlApprovals.$inferSelect;
export type QualityControlApprovalInsert = typeof qualityControlApprovals.$inferInsert;
