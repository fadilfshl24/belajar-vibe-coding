import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  decimal,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { uoms } from "../uom/uom.schema";
import { itemCategories } from "../category/category.schema";

/**
 * Enum: item_type
 *
 * - single  : Barang satuan, dijual/digunakan secara individual
 * - package : Bundel dari beberapa item single dengan harga paket tersendiri
 */
export const itemTypeEnum = pgEnum("item_type", ["single", "package"]);

/**
 * Tabel: items
 *
 * Master data barang/produk. Berlaku untuk tipe 'single' maupun 'package'.
 * Jika item_type = 'package', komponen penyusun disimpan di tabel item_package_details.
 *
 * Kolom diskon (discount_percentage, discount_price, price_after_discount) berlaku
 * untuk item tipe package sebagai diskon harga paket keseluruhan.
 */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    uomId: uuid("uom_id")
      .notNull()
      .references(() => uoms.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => itemCategories.id),
    barcodeText: varchar("barcode_text", { length: 150 }).unique(),
    barcodeType: varchar("barcode_type", { length: 50 }),  // EAN-13, CODE-128, QR, dll.
    imageUrl: text("image_url"),
    itemType: itemTypeEnum("item_type").notNull().default("single"),
    purchasePrice: decimal("purchase_price", { precision: 15, scale: 2 }).notNull().default("0.00"),
    sellingPrice: decimal("selling_price", { precision: 15, scale: 2 }).notNull().default("0.00"),

    // Kolom harga paket (hanya relevan jika itemType = 'package')
    discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).notNull().default("0.00"),
    discountPrice: decimal("discount_price", { precision: 15, scale: 2 }).notNull().default("0.00"),
    priceAfterDiscount: decimal("price_after_discount", { precision: 15, scale: 2 }).notNull().default("0.00"),
    isAsset: boolean("is_asset").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),

    ...auditColumns,
  },
  (t) => [
    index("idx_items_code").on(t.code),
    index("idx_items_uom_id").on(t.uomId),
    index("idx_items_category_id").on(t.categoryId),
    index("idx_items_item_type").on(t.itemType),
    index("idx_items_is_active").on(t.isActive),
    index("idx_items_deleted_at").on(t.deletedAt),
    index("idx_items_barcode_text").on(t.barcodeText),
  ]
);

/**
 * Tabel: item_package_details
 *
 * Menyimpan komponen penyusun dari sebuah item bertipe 'package'.
 * Harga per komponen di sini adalah OVERRIDE dari harga satuan (selling_price) item individual -
 * memungkinkan satu item memiliki harga berbeda ketika dijual satuan vs sebagai bagian dari paket.
 */
export const itemPackageDetails = pgTable(
  "item_package_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageItemId: uuid("package_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    childItemId: uuid("child_item_id")
      .notNull()
      .references(() => items.id),
    quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1.00"),
    isActive: boolean("is_active").notNull().default(true),

    // Harga override (berbeda dari selling_price item satuan)
    price: decimal("price", { precision: 15, scale: 2 }).notNull().default("0.00"),
    discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).notNull().default("0.00"),
    discountPrice: decimal("discount_price", { precision: 15, scale: 2 }).notNull().default("0.00"),
    priceAfterDiscount: decimal("price_after_discount", { precision: 15, scale: 2 }).notNull().default("0.00"),

    ...auditColumns,
  },
  (t) => [
    index("idx_item_pkg_details_package_item_id").on(t.packageItemId),
    index("idx_item_pkg_details_child_item_id").on(t.childItemId),
  ]
);

export type ItemRecord = typeof items.$inferSelect;
export type ItemInsert = typeof items.$inferInsert;
export type ItemPackageDetailRecord = typeof itemPackageDetails.$inferSelect;
export type ItemPackageDetailInsert = typeof itemPackageDetails.$inferInsert;

import { relations } from "drizzle-orm";

export const itemsRelations = relations(items, ({ one }) => ({
  category: one(itemCategories, {
    fields: [items.categoryId],
    references: [itemCategories.id],
  }),
  uom: one(uoms, {
    fields: [items.uomId],
    references: [uoms.id],
  }),
}));