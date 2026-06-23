import { pgTable, varchar } from "drizzle-orm/pg-core";

export const provinces = pgTable("regions_provinces", {
  id: varchar("id", { length: 2 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
});

export const regencies = pgTable("regions_regencies", {
  id: varchar("id", { length: 4 }).primaryKey(),
  provinceId: varchar("province_id", { length: 2 })
    .notNull()
    .references(() => provinces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
});

export const districts = pgTable("regions_districts", {
  id: varchar("id", { length: 7 }).primaryKey(),
  regencyId: varchar("regency_id", { length: 4 })
    .notNull()
    .references(() => regencies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
});

export const villages = pgTable("regions_villages", {
  id: varchar("id", { length: 10 }).primaryKey(),
  districtId: varchar("district_id", { length: 7 })
    .notNull()
    .references(() => districts.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
});
