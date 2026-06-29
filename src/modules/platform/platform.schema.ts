import { pgTable, uuid, varchar, text, boolean, index } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";

export const platforms = pgTable(
  "platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    image: text("image"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    index("idx_platforms_code").on(t.code),
    index("idx_platforms_is_active").on(t.isActive),
    index("idx_platforms_deleted_at").on(t.deletedAt),
  ]
);

export type PlatformRecord = typeof platforms.$inferSelect;
export type PlatformInsert = typeof platforms.$inferInsert;
