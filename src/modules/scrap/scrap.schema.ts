import { pgTable, uuid, varchar, text, integer, decimal, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { warehouses } from "../warehouse/warehouse.schema";
import { items } from "../item/item.schema";

export const scraps = pgTable(
  "scraps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(), // e.g. SC-20260714-0001
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    type: varchar("type", { length: 10 }).notNull(), // "IN" atau "OUT"
    reasonCategory: varchar("reason_category", { length: 50 }).notNull(), // "DAMAGED", "LOST", "QC_REJECT", "CUSTOMER_REFUND", "OTHER"
    notes: text("notes"),
    status: integer("status").notNull().default(0), // 0=Draft, 1=Pending Approval, 2=Approved, 3=Rejected
    currentApprovalStage: integer("current_approval_stage").notNull().default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_scraps_code").on(t.code),
    index("idx_scraps_warehouse_id").on(t.warehouseId),
    index("idx_scraps_status").on(t.status),
    index("idx_scraps_deleted_at").on(t.deletedAt),
  ]
);

export const scrapDetails = pgTable(
  "scrap_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scrapId: uuid("scrap_id")
      .notNull()
      .references(() => scraps.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull().default("0.00"),
    notes: text("notes"),
    ...auditColumns,
  },
  (t) => [
    index("idx_scrap_details_scrap_id").on(t.scrapId),
    index("idx_scrap_details_item_id").on(t.itemId),
    index("idx_scrap_details_deleted_at").on(t.deletedAt),
  ]
);

export const scrapsRelations = relations(scraps, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [scraps.warehouseId],
    references: [warehouses.id],
  }),
  details: many(scrapDetails),
}));

export const scrapDetailsRelations = relations(scrapDetails, ({ one }) => ({
  scrap: one(scraps, {
    fields: [scrapDetails.scrapId],
    references: [scraps.id],
  }),
  item: one(items, {
    fields: [scrapDetails.itemId],
    references: [items.id],
  }),
}));

export type ScrapRecord = typeof scraps.$inferSelect;
export type ScrapInsert = typeof scraps.$inferInsert;
export type ScrapDetailRecord = typeof scrapDetails.$inferSelect;
export type ScrapDetailInsert = typeof scrapDetails.$inferInsert;
