import { pgTable, uuid, varchar, text, boolean, index, pgEnum } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";

export const customerTypeEnum = pgEnum("customer_type", ["company", "personal"]);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    type: customerTypeEnum("type").notNull().default("company"),
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
    index("idx_customers_code").on(t.code),
    index("idx_customers_is_active").on(t.isActive),
    index("idx_customers_deleted_at").on(t.deletedAt),
  ]
);

export type CustomerRecord = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;
