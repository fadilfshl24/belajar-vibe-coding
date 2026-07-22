import { pgTable, uuid, varchar, text, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { sql } from "drizzle-orm";

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    address: text("address"),
    province: varchar("province", { length: 100 }),
    cityRegency: varchar("city_regency", { length: 100 }),
    district: varchar("district", { length: 100 }),
    village: varchar("village", { length: 100 }),
    zipCode: varchar("zip_code", { length: 20 }),
    image: text("image"),
    latitude: varchar("latitude", { length: 50 }),
    longitude: varchar("longitude", { length: 50 }),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex("idx_vendors_code_active").on(t.code).where(sql`deleted_at IS NULL`),
    index("idx_vendors_code").on(t.code),
    index("idx_vendors_is_active").on(t.isActive),
    index("idx_vendors_deleted_at").on(t.deletedAt),
  ]
);

export type VendorRecord = typeof vendors.$inferSelect;
export type VendorInsert = typeof vendors.$inferInsert;
