import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  pgEnum,
  index,
  timestamp,
} from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { warehouses } from "../warehouse/warehouse.schema";
import { items } from "../item/item.schema";
import { users } from "../user/user.schema";

export const transactionTypeEnum = pgEnum("transaction_type", ["IN", "OUT"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["DRAFT", "COMPLETED", "CANCEL_PENDING", "CANCELLED"]);
export const approvalStatusEnum = pgEnum("approval_status", ["PENDING", "APPROVED", "REJECTED"]);
export const approvalTypeEnum = pgEnum("approval_type", ["CANCEL"]);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    type: transactionTypeEnum("type").notNull(),
    referenceNumber: varchar("reference_number", { length: 100 }).notNull().unique(),
    description: text("description"),
    transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull().defaultNow(),
    status: transactionStatusEnum("status").notNull().default("DRAFT"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [
    index("idx_transactions_warehouse_id").on(t.warehouseId),
    index("idx_transactions_type").on(t.type),
    index("idx_transactions_status").on(t.status),
    index("idx_transactions_date").on(t.transactionDate),
  ]
);

export const transactionItems = pgTable(
  "transaction_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull().default("0.00"),
    ...auditColumns,
  },
  (t) => [
    index("idx_transaction_items_transaction_id").on(t.transactionId),
    index("idx_transaction_items_item_id").on(t.itemId),
  ]
);

export const transactionApprovals = pgTable(
  "transaction_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    type: approvalTypeEnum("type").notNull().default("CANCEL"),
    status: approvalStatusEnum("status").notNull().default("PENDING"),
    remark: text("remark").notNull(),
    responseRemark: text("response_remark"),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),
    approvedBy: uuid("approved_by")
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [
    index("idx_transaction_approvals_transaction_id").on(t.transactionId),
    index("idx_transaction_approvals_status").on(t.status),
  ]
);

export type TransactionRecord = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItemRecord = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionApprovalRecord = typeof transactionApprovals.$inferSelect;
export type TransactionApprovalInsert = typeof transactionApprovals.$inferInsert;
