import { pgTable, uuid, varchar, integer, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { roles } from "../role/role.schema";

export const approvalSteps = pgTable(
  "approval_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentType: varchar("document_type", { length: 20 }).notNull(), // 'PR', 'QP', 'PO'
    stage: integer("stage").notNull(), // 0, 1, 2, etc.
    roleId: uuid("role_id").notNull().references(() => roles.id),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_approval_steps_doc_type").on(t.documentType),
    index("idx_approval_steps_doc_type_stage").on(t.documentType, t.stage),
    index("idx_approval_steps_deleted_at").on(t.deletedAt),
  ]
);

export type ApprovalStepRecord = typeof approvalSteps.$inferSelect;
export type ApprovalStepInsert = typeof approvalSteps.$inferInsert;

export const approvalStepsRelations = relations(approvalSteps, ({ one }) => ({
  role: one(roles, {
    fields: [approvalSteps.roleId],
    references: [roles.id],
  }),
}));
