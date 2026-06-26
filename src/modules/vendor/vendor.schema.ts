import { pgTable, uuid, varchar, text, boolean, index } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(),
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
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_vendors_code").on(t.code),
    index("idx_vendors_is_active").on(t.isActive),
    index("idx_vendors_deleted_at").on(t.deletedAt),
  ]
);

export type VendorRecord = typeof vendors.$inferSelect;
export type VendorInsert = typeof vendors.$inferInsert;
