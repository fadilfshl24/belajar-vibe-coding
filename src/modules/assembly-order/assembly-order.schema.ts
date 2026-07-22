import { pgTable, uuid, varchar, text, integer, decimal, index, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "../../core/db/audit";
import { warehouses } from "../warehouse/warehouse.schema";
import { items } from "../item/item.schema";
import { users } from "../user/user.schema";

export const assemblyOrders = pgTable(
  "assembly_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(), // e.g., AO-20260717-0001
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    notes: text("notes"),
    status: integer("status").notNull().default(0), // 0=Draft, 1=Pending Approval, 2=Approved, 3=Rejected
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...auditColumns,
  },
  (t) => [
    index("idx_assembly_orders_code").on(t.code),
    index("idx_assembly_orders_warehouse_id").on(t.warehouseId),
    index("idx_assembly_orders_status").on(t.status),
    index("idx_assembly_orders_deleted_at").on(t.deletedAt),
  ]
);

export const assemblyOrderDetails = pgTable(
  "assembly_order_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assemblyOrderId: uuid("assembly_order_id")
      .notNull()
      .references(() => assemblyOrders.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id), // Finished good (type: package)
    quantityProduced: decimal("quantity_produced", { precision: 12, scale: 4 }).notNull().default("0.0000"),
    unitCost: decimal("unit_cost", { precision: 12, scale: 4 }).notNull().default("0.0000"), // HPP per unit at the time of assembly
    totalCost: decimal("total_cost", { precision: 12, scale: 4 }).notNull().default("0.0000"),
    ...auditColumns,
  },
  (t) => [
    index("idx_assembly_order_details_ao_id").on(t.assemblyOrderId),
    index("idx_assembly_order_details_item_id").on(t.itemId),
    index("idx_assembly_order_details_deleted_at").on(t.deletedAt),
  ]
);

export const assemblyOrderComponents = pgTable(
  "assembly_order_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assemblyOrderDetailId: uuid("assembly_order_detail_id")
      .notNull()
      .references(() => assemblyOrderDetails.id, { onDelete: "cascade" }),
    componentItemId: uuid("component_item_id")
      .notNull()
      .references(() => items.id), // Raw material (type: single)
    quantityUsed: decimal("quantity_used", { precision: 12, scale: 4 }).notNull().default("0.0000"),
    quantityReturned: decimal("quantity_returned", { precision: 12, scale: 4 }).notNull().default("0.0000"),
    pricePerUnit: decimal("price_per_unit", { precision: 12, scale: 4 }).notNull().default("0.0000"), // items.purchase_price
    ...auditColumns,
  },
  (t) => [
    index("idx_assembly_order_components_detail_id").on(t.assemblyOrderDetailId),
    index("idx_assembly_order_components_item_id").on(t.componentItemId),
    index("idx_assembly_order_components_deleted_at").on(t.deletedAt),
  ]
);

// Relationships
export const assemblyOrdersRelations = relations(assemblyOrders, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [assemblyOrders.warehouseId],
    references: [warehouses.id],
  }),
  creator: one(users, {
    fields: [assemblyOrders.createdBy],
    references: [users.id],
    relationName: "assembly_orders_created_by",
  }),
  approver: one(users, {
    fields: [assemblyOrders.approvedBy],
    references: [users.id],
    relationName: "assembly_orders_approved_by",
  }),
  details: many(assemblyOrderDetails),
}));

export const assemblyOrderDetailsRelations = relations(assemblyOrderDetails, ({ one, many }) => ({
  assemblyOrder: one(assemblyOrders, {
    fields: [assemblyOrderDetails.assemblyOrderId],
    references: [assemblyOrders.id],
  }),
  item: one(items, {
    fields: [assemblyOrderDetails.itemId],
    references: [items.id],
  }),
  components: many(assemblyOrderComponents),
}));

export const assemblyOrderComponentsRelations = relations(assemblyOrderComponents, ({ one }) => ({
  assemblyOrderDetail: one(assemblyOrderDetails, {
    fields: [assemblyOrderComponents.assemblyOrderDetailId],
    references: [assemblyOrderDetails.id],
  }),
  componentItem: one(items, {
    fields: [assemblyOrderComponents.componentItemId],
    references: [items.id],
  }),
}));

export type AssemblyOrderRecord = typeof assemblyOrders.$inferSelect;
export type AssemblyOrderInsert = typeof assemblyOrders.$inferInsert;
export type AssemblyOrderDetailRecord = typeof assemblyOrderDetails.$inferSelect;
export type AssemblyOrderDetailInsert = typeof assemblyOrderDetails.$inferInsert;
export type AssemblyOrderComponentRecord = typeof assemblyOrderComponents.$inferSelect;
export type AssemblyOrderComponentInsert = typeof assemblyOrderComponents.$inferInsert;
