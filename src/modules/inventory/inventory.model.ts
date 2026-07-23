import { db } from "../../core/db";
import { inventoryStocks } from "./inventory.schema";
import { eq, and, sql, asc, desc, ilike, or, isNull, inArray } from "drizzle-orm";
import { items } from "../item/item.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { uoms } from "../uom/uom.schema";
import { itemCategories } from "../category/category.schema";

interface FindAllOptions {
  page: number;
  limit: number;
  warehouseId?: string;
  warehouseIds?: string[];
  itemId?: string;
  categoryId?: string;
  searchTerm?: string;
}

export class InventoryModel {
  static async findAll(opts: FindAllOptions) {
    const offset = (opts.page - 1) * opts.limit;
    const conditions = [isNull(inventoryStocks.deletedAt)];

    if (opts.warehouseId) {
      conditions.push(eq(inventoryStocks.warehouseId, opts.warehouseId));
    } else if (opts.warehouseIds && opts.warehouseIds.length > 0) {
      conditions.push(inArray(inventoryStocks.warehouseId, opts.warehouseIds));
    }
    if (opts.itemId) {
      conditions.push(eq(inventoryStocks.itemId, opts.itemId));
    }
    if (opts.categoryId) {
      conditions.push(eq(items.categoryId, opts.categoryId));
    }
    if (opts.searchTerm) {
      conditions.push(
        or(
          ilike(items.name, `%${opts.searchTerm}%`),
          ilike(items.code, `%${opts.searchTerm}%`),
          ilike(warehouses.name, `%${opts.searchTerm}%`)
        )!
      );
    }

    const whereClause = and(...conditions);

    const query = db
      .select({
        id: inventoryStocks.id,
        physicalQty: inventoryStocks.physicalQty,
        reservedQty: inventoryStocks.reservedQty,
        availableQty: inventoryStocks.availableQty,
        warehouseId: inventoryStocks.warehouseId,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        itemId: inventoryStocks.itemId,
        itemCode: items.code,
        itemName: items.name,
        isAsset: items.isAsset,
        categoryId: items.categoryId,
        categoryName: itemCategories.name,
        categoryCode: itemCategories.code,
        uomId: items.uomId,
        uomName: uoms.name,
        uomCode: uoms.code,
        updatedAt: inventoryStocks.updatedAt,
      })
      .from(inventoryStocks)
      .innerJoin(items, eq(inventoryStocks.itemId, items.id))
      .innerJoin(warehouses, eq(inventoryStocks.warehouseId, warehouses.id))
      .leftJoin(uoms, eq(items.uomId, uoms.id))
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .where(whereClause)
      .orderBy(desc(inventoryStocks.updatedAt))
      .limit(opts.limit)
      .offset(offset);

    return await query;
  }

  static async countAll(opts: Omit<FindAllOptions, "page" | "limit">) {
    const conditions = [isNull(inventoryStocks.deletedAt)];

    if (opts.warehouseId) {
      conditions.push(eq(inventoryStocks.warehouseId, opts.warehouseId));
    } else if (opts.warehouseIds && opts.warehouseIds.length > 0) {
      conditions.push(inArray(inventoryStocks.warehouseId, opts.warehouseIds));
    }
    if (opts.itemId) {
      conditions.push(eq(inventoryStocks.itemId, opts.itemId));
    }
    if (opts.categoryId) {
      conditions.push(eq(items.categoryId, opts.categoryId));
    }
    if (opts.searchTerm) {
      conditions.push(
        or(
          ilike(items.name, `%${opts.searchTerm}%`),
          ilike(items.code, `%${opts.searchTerm}%`),
          ilike(warehouses.name, `%${opts.searchTerm}%`)
        )!
      );
    }

    const whereClause = and(...conditions);

    const [record] = await db
      .select({ count: sql<number>`cast(count(${inventoryStocks.id}) as int)` })
      .from(inventoryStocks)
      .innerJoin(items, eq(inventoryStocks.itemId, items.id))
      .innerJoin(warehouses, eq(inventoryStocks.warehouseId, warehouses.id))
      .leftJoin(uoms, eq(items.uomId, uoms.id))
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .where(whereClause);

    return record?.count ?? 0;
  }
}
