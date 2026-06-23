import { db } from "../../core/db";
import { inventoryStocks } from "./inventory.schema";
import { eq, and, sql, asc, desc, ilike, or } from "drizzle-orm";
import { items } from "../item/item.schema";
import { warehouses } from "../warehouse/warehouse.schema";

interface FindAllOptions {
  page: number;
  limit: number;
  warehouseId?: string;
  itemId?: string;
  searchTerm?: string;
}

export class InventoryModel {
  static async findAll(opts: FindAllOptions) {
    const offset = (opts.page - 1) * opts.limit;
    const conditions = [eq(inventoryStocks.deletedAt, null)];

    if (opts.warehouseId) {
      conditions.push(eq(inventoryStocks.warehouseId, opts.warehouseId));
    }
    if (opts.itemId) {
      conditions.push(eq(inventoryStocks.itemId, opts.itemId));
    }
    if (opts.searchTerm) {
      conditions.push(
        or(
          ilike(items.name, `%${opts.searchTerm}%`),
          ilike(items.code, `%${opts.searchTerm}%`),
          ilike(warehouses.name, `%${opts.searchTerm}%`)
        )
      );
    }

    const whereClause = and(...conditions);

    const query = db
      .select({
        id: inventoryStocks.id,
        quantity: inventoryStocks.quantity,
        warehouseId: inventoryStocks.warehouseId,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        itemId: inventoryStocks.itemId,
        itemCode: items.code,
        itemName: items.name,
        updatedAt: inventoryStocks.updatedAt,
      })
      .from(inventoryStocks)
      .innerJoin(items, eq(inventoryStocks.itemId, items.id))
      .innerJoin(warehouses, eq(inventoryStocks.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(inventoryStocks.updatedAt))
      .limit(opts.limit)
      .offset(offset);

    return await query;
  }

  static async countAll(opts: Omit<FindAllOptions, "page" | "limit">) {
    const conditions = [eq(inventoryStocks.deletedAt, null)];

    if (opts.warehouseId) {
      conditions.push(eq(inventoryStocks.warehouseId, opts.warehouseId));
    }
    if (opts.itemId) {
      conditions.push(eq(inventoryStocks.itemId, opts.itemId));
    }
    if (opts.searchTerm) {
      conditions.push(
        or(
          ilike(items.name, `%${opts.searchTerm}%`),
          ilike(items.code, `%${opts.searchTerm}%`),
          ilike(warehouses.name, `%${opts.searchTerm}%`)
        )
      );
    }

    const whereClause = and(...conditions);

    const [record] = await db
      .select({ count: sql<number>`cast(count(${inventoryStocks.id}) as int)` })
      .from(inventoryStocks)
      .innerJoin(items, eq(inventoryStocks.itemId, items.id))
      .innerJoin(warehouses, eq(inventoryStocks.warehouseId, warehouses.id))
      .where(whereClause);

    return record?.count ?? 0;
  }
}
