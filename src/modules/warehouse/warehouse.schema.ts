import { pgTable, uuid, varchar, text, decimal, boolean, index } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { users } from "../user/user.schema";

/**
 * Tabel: warehouses
 *
 * Menyimpan daftar gudang yang ada di sistem WMS.
 * Ditambahkan dengan data alamat dan koordinat GPS.
 */
export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    address: text("address"),
    province: varchar("province", { length: 20 }),
    cityRegency: varchar("city_regency", { length: 20 }),
    district: varchar("district", { length: 20 }),
    village: varchar("village", { length: 20 }),
    zipCode: varchar("zip_code", { length: 10 }),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_warehouses_code").on(t.code),
    index("idx_warehouses_is_active").on(t.isActive),
    index("idx_warehouses_deleted_at").on(t.deletedAt),
  ]
);

/**
 * Tabel: warehouse_heads
 *
 * Menghubungkan user (kepala gudang) dengan warehouse.
 */
export const warehouseHeads = pgTable(
  "warehouse_heads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    description: text("description"),
    ...auditColumns,
  },
  (t) => [
    index("idx_warehouse_heads_warehouse_id").on(t.warehouseId),
    index("idx_warehouse_heads_user_id").on(t.userId),
    index("idx_warehouse_heads_is_active").on(t.isActive),
  ]
);

export type WarehouseRecord = typeof warehouses.$inferSelect;
export type WarehouseInsert = typeof warehouses.$inferInsert;
export type WarehouseHeadRecord = typeof warehouseHeads.$inferSelect;
export type WarehouseHeadInsert = typeof warehouseHeads.$inferInsert;
