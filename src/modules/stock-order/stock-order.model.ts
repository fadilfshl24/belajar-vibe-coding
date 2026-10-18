import { db } from "../../core/db";
import {
  stockOrders, stockOrderItems,
  stockOrderItemMappings, stockOrderReturns, stockOrderReturnItems,
  type StockOrderInsert, type StockOrderItemInsert,
  type StockOrderItemMappingInsert,
  type StockOrderReturnInsert, type StockOrderReturnItemInsert,
} from "./stock-order.schema";
import { eq, and, isNull, desc, ilike, or, inArray, sql, gte, lte } from "drizzle-orm";
import { items, itemPackageDetails } from "../item/item.schema";
import { uoms } from "../uom/uom.schema";
import { itemCategories } from "../category/category.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { inventoryStocks } from "../inventory/inventory.schema";
import { userWarehouseMappings, userWarehouseRoles } from "../role/role.schema";
import type { PackWithMappingPayload, ProcessReturnPayload } from "./stock-order.validation";

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

interface FindAllOptions {
  page: number;
  limit: number;
  warehouseId?: string;
  warehouseIds?: string[];
  search?: string;
  status?: "UNPACKED" | "PACKED" | "SENDING" | "DONE" | "RETURNED";
  paymentMethod?: string;
  type?: "INBOUND" | "OUTBOUND";
  purchaseChannel?: string;
  startDate?: string;
  endDate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get first warehouseId mapped to a user
// ─────────────────────────────────────────────────────────────────────────────

async function getUserWarehouseId(userId: string): Promise<string | null> {
  const [mapping] = await db
    .select({ warehouseId: userWarehouseMappings.warehouseId })
    .from(userWarehouseMappings)
    .where(and(eq(userWarehouseMappings.userId, userId), isNull(userWarehouseMappings.deletedAt)))
    .limit(1);

  return mapping?.warehouseId ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────────────────────

export class StockOrderModel {
  // ── CREATE ─────────────────────────────────────────────────────────────────

  static async create(orderData: StockOrderInsert, orderItems: StockOrderItemInsert[], tx?: any) {
    const executor = tx || db;
    return await executor.transaction(async (trx: any) => {
      const [order] = await trx.insert(stockOrders).values(orderData).returning();
      if (orderItems.length > 0) {
        const itemsToInsert = orderItems.map((item) => ({ ...item, stockOrderId: order.id }));
        await trx.insert(stockOrderItems).values(itemsToInsert);
      }
      return order;
    });
  }

  // ── FIND BY ID ─────────────────────────────────────────────────────────────

  static async findById(id: string) {
    const [order] = await db
      .select({
        id: stockOrders.id,
        purchaseChannel: stockOrders.purchaseChannel,
        trackingId: stockOrders.trackingId,
        orderId: stockOrders.orderId,
        warehouseId: stockOrders.warehouseId,
        status: stockOrders.status,
        type: stockOrders.type,
        paymentMethod: stockOrders.paymentMethod,
        shippingProviderName: stockOrders.shippingProviderName,
        buyerUsername: stockOrders.buyerUsername,
        recipient: stockOrders.recipient,
        phone: stockOrders.phone,
        sellerNote: stockOrders.sellerNote,
        remark: stockOrders.remark,
        packedBy: stockOrders.packedBy,
        packedAt: stockOrders.packedAt,
        returnedBy: stockOrders.returnedBy,
        returnedAt: stockOrders.returnedAt,
        platformCreatedAt: stockOrders.platformCreatedAt,
        platformPaidAt: stockOrders.platformPaidAt,
      })
      .from(stockOrders)
      .where(and(eq(stockOrders.id, id), isNull(stockOrders.deletedAt)));

    if (!order) return null;

    const orderDetails = await db
      .select({
        id: stockOrderItems.id,
        stockOrderId: stockOrderItems.stockOrderId,
        itemId: stockOrderItems.itemId,
        skuId: stockOrderItems.skuId,
        skuName: stockOrderItems.skuName,
        skuPrice: stockOrderItems.skuPrice,
        quantity: stockOrderItems.quantity,
        itemCode: items.code,
        itemName: items.name,
      })
      .from(stockOrderItems)
      .innerJoin(items, eq(stockOrderItems.itemId, items.id))
      .where(eq(stockOrderItems.stockOrderId, id));

    return { ...order, items: orderDetails };
  }

  // ── FIND BY TRACKING ID ────────────────────────────────────────────────────

  static async findByTrackingId(trackingId: string, type?: "INBOUND" | "OUTBOUND") {
    const conditions = [eq(stockOrders.trackingId, trackingId), isNull(stockOrders.deletedAt)];
    if (type) conditions.push(eq(stockOrders.type, type));

    const [order] = await db.select().from(stockOrders).where(and(...conditions));
    if (!order) return null;
    return this.findById(order.id);
  }

  // ── FIND ALL ───────────────────────────────────────────────────────────────

  static async findAll(opts: FindAllOptions) {
    const offset = (opts.page - 1) * opts.limit;
    const conditions = [isNull(stockOrders.deletedAt)];

    if (opts.warehouseId) {
      conditions.push(eq(stockOrders.warehouseId, opts.warehouseId));
    } else if (opts.warehouseIds && opts.warehouseIds.length > 0) {
      conditions.push(inArray(stockOrders.warehouseId, opts.warehouseIds));
    }
    if (opts.status) conditions.push(eq(stockOrders.status, opts.status));
    if (opts.paymentMethod) conditions.push(ilike(stockOrders.paymentMethod, `%${opts.paymentMethod}%`));
    if (opts.type) conditions.push(eq(stockOrders.type, opts.type));
    if (opts.purchaseChannel) conditions.push(eq(stockOrders.purchaseChannel, opts.purchaseChannel));

    if (opts.startDate) {
      const start = new Date(opts.startDate);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(stockOrders.createdAt, start));
    }
    if (opts.endDate) {
      const end = new Date(opts.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(stockOrders.createdAt, end));
    }

    if (opts.search) {
      conditions.push(
        or(
          ilike(stockOrders.trackingId, `%${opts.search}%`),
          ilike(stockOrders.orderId, `%${opts.search}%`),
          ilike(stockOrders.recipient, `%${opts.search}%`)
        )!
      );
    }

    const whereClause = and(...conditions);

    const data = await db
      .select({
        id: stockOrders.id,
        purchaseChannel: stockOrders.purchaseChannel,
        trackingId: stockOrders.trackingId,
        orderId: stockOrders.orderId,
        status: stockOrders.status,
        type: stockOrders.type,
        paymentMethod: stockOrders.paymentMethod,
        recipient: stockOrders.recipient,
        warehouseId: stockOrders.warehouseId,
        warehouseName: warehouses.name,
        createdAt: stockOrders.createdAt,
      })
      .from(stockOrders)
      .innerJoin(warehouses, eq(stockOrders.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(stockOrders.createdAt))
      .limit(opts.limit)
      .offset(offset);

    const [countRecord] = await db
      .select({ count: sql<number>`cast(count(${stockOrders.id}) as int)` })
      .from(stockOrders)
      .innerJoin(warehouses, eq(stockOrders.warehouseId, warehouses.id))
      .where(whereClause);

    return { data, count: countRecord?.count ?? 0 };
  }

  // ── SCAN FOR OUTBOUND ──────────────────────────────────────────────────────

  /**
   * Scan resi untuk outbound. Memvalidasi:
   * - Resi ditemukan
   * - Warehouse resi cocok dengan warehouse user (dari JWT)
   * - Status resi = UNPACKED
   *
   * Returns data resi + platform items dengan available_qty per item.
   */
  static async scanForOutbound(trackingId: string, userId: string) {
    // 1. Get user's warehouse
    const warehouseId = await getUserWarehouseId(userId);
    if (!warehouseId) {
      throw { code: 400, message: "User tidak terdaftar di gudang manapun. Hubungi administrator." };
    }

    // 2. Find order by tracking ID
    const [order] = await db
      .select()
      .from(stockOrders)
      .where(and(eq(stockOrders.trackingId, trackingId), isNull(stockOrders.deletedAt)));

    if (!order) {
      throw { code: 404, message: `No. Resi '${trackingId}' tidak ditemukan di sistem.` };
    }

    // 3. Validate warehouse
    if (order.warehouseId !== warehouseId) {
      throw { code: 403, message: `No. Resi ini bukan untuk gudang Anda. Pastikan resi sudah di-assign ke gudang yang benar.` };
    }

    // 4. Validate status
    if (order.status !== "UNPACKED") {
      throw {
        code: 409,
        message: `Pesanan sudah berstatus ${order.status}. Hanya pesanan UNPACKED yang bisa di-pack.`,
        data: { status: order.status },
      };
    }

    // 5. Load platform items + available stock per item
    const rawPlatformItems = await db
      .select({
        id: stockOrderItems.id,
        itemId: stockOrderItems.itemId,
        skuId: stockOrderItems.skuId,
        skuName: stockOrderItems.skuName,
        quantity: stockOrderItems.quantity,
        itemCode: items.code,
        itemName: items.name,
        itemType: items.itemType,
        availableQty: inventoryStocks.availableQty,
      })
      .from(stockOrderItems)
      .innerJoin(items, eq(stockOrderItems.itemId, items.id))
      .leftJoin(
        inventoryStocks,
        and(
          eq(inventoryStocks.itemId, stockOrderItems.itemId),
          eq(inventoryStocks.warehouseId, warehouseId),
          isNull(inventoryStocks.deletedAt)
        )
      )
      .where(and(eq(stockOrderItems.stockOrderId, order.id), isNull(stockOrderItems.deletedAt)));

    const platformItems = await Promise.all(
      rawPlatformItems.map(async (pi) => {
        const packageDetails = await db
          .select({
            id: itemPackageDetails.id,
            childItemId: itemPackageDetails.childItemId,
            childItemCode: items.code,
            childItemName: items.name,
            quantity: itemPackageDetails.quantity,
            uomName: uoms.name,
            uomCode: uoms.code,
            categoryName: itemCategories.name,
          })
          .from(itemPackageDetails)
          .innerJoin(items, eq(itemPackageDetails.childItemId, items.id))
          .leftJoin(uoms, eq(items.uomId, uoms.id))
          .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
          .where(
            and(
              eq(itemPackageDetails.packageItemId, pi.itemId),
              isNull(itemPackageDetails.deletedAt)
            )
          );

        return {
          ...pi,
          packageDetails,
        };
      })
    );

    return {
      order: {
        id: order.id,
        trackingId: order.trackingId,
        orderId: order.orderId,
        status: order.status,
        recipient: order.recipient,
        paymentMethod: order.paymentMethod,
        purchaseChannel: order.purchaseChannel,
        shippingProviderName: order.shippingProviderName,
        sellerNote: order.sellerNote,
        warehouseId: order.warehouseId,
      },
      platformItems,
    };
  }

  // ── PACK WITH MAPPING ──────────────────────────────────────────────────────

  /**
   * Konfirmasi packing dengan mapping item fisik.
   * - Insert ke stock_order_item_mappings
   * - Kurangi inventory_stocks per item mapping
   * - Update status order → PACKED
   */
  static async packWithMapping(orderId: string, userId: string, payload: PackWithMappingPayload) {
    return await db.transaction(async (trx) => {
      // 1. Cek order exist & status UNPACKED
      const [order] = await trx
        .select()
        .from(stockOrders)
        .where(and(eq(stockOrders.id, orderId), isNull(stockOrders.deletedAt)))
        .for("update");

      if (!order) throw { code: 404, message: "Order tidak ditemukan." };
      if (order.status !== "UNPACKED") throw { code: 409, message: `Order sudah berstatus ${order.status}. Tidak bisa di-pack ulang.` };

      // 2. Get user warehouse
      const warehouseId = await getUserWarehouseId(userId);
      if (!warehouseId) throw { code: 400, message: "User tidak terdaftar di gudang manapun. Hubungi administrator." };
      if (order.warehouseId !== warehouseId) throw { code: 403, message: "Order ini bukan untuk gudang Anda." };

      // 3. Proses setiap item mapping
      const mappingInserts: StockOrderItemMappingInsert[] = [];

      const mappedItemIds = payload.mappedItems.map(m => m.itemId);
      const uniqueMappedItemIds = [...new Set(mappedItemIds)];

      const stocks = uniqueMappedItemIds.length > 0 ? await trx
        .select()
        .from(inventoryStocks)
        .where(
          and(
            eq(inventoryStocks.warehouseId, warehouseId),
            inArray(inventoryStocks.itemId, uniqueMappedItemIds),
            isNull(inventoryStocks.deletedAt)
          )
        )
        .for("update") : [];

      const stockMap = new Map(stocks.map(s => [s.itemId, s]));

      // We also aggregate mappedItems to handle multiple mappings of the same item ID
      const mappedAggregated = new Map<string, number>();
      for (const mapped of payload.mappedItems) {
         mappedAggregated.set(mapped.itemId, (mappedAggregated.get(mapped.itemId) || 0) + mapped.quantity);
      }

      for (const [itemId, totalQty] of mappedAggregated.entries()) {
        const stock = stockMap.get(itemId);
        if (!stock) {
          throw { code: 400, message: `Item (id: ${itemId}) tidak memiliki stok di gudang ini.` };
        }
        if (Number(stock.availableQty) < totalQty) {
          throw {
            code: 400,
            message: `Stok available untuk item (id: ${itemId}) tidak mencukupi. Tersedia: ${stock.availableQty}, Dibutuhkan: ${totalQty}.`
          };
        }
      }

      // Update stocks sequentially because Promise.all is restricted in transactions
      for (const [itemId, totalQty] of mappedAggregated.entries()) {
        const stock = stockMap.get(itemId);
        if (stock) {
          await trx
            .update(inventoryStocks)
            .set({
              physicalQty: sql`${inventoryStocks.physicalQty} - ${totalQty}`,
              availableQty: sql`${inventoryStocks.availableQty} - ${totalQty}`,
              updatedAt: new Date(),
              updatedBy: userId,
            })
            .where(eq(inventoryStocks.id, stock.id));
        }
      }

      for (const mapped of payload.mappedItems) {
        mappingInserts.push({
          stockOrderId: orderId,
          itemId: mapped.itemId,
          quantity: mapped.quantity.toString(),
          isAutoRestockIfReturn: mapped.isAutoRestockIfReturn,
          createdBy: userId,
          updatedBy: userId,
        });
      }
      await trx.insert(stockOrderItemMappings).values(mappingInserts);

      // 5. Update order status
      const [updated] = await trx
        .update(stockOrders)
        .set({
          status: "PACKED",
          remark: payload.remark ?? null,
          packedBy: userId,
          packedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(stockOrders.id, orderId))
        .returning();

      return updated;
    });
  }

  // ── SCAN FOR INBOUND ───────────────────────────────────────────────────────

  /**
   * Scan resi untuk inbound return. Memvalidasi:
   * - Resi ditemukan
   * - Warehouse cocok
   * - Status PACKED atau SENDING
   *
   * Returns data resi + item mappings dari outbound scan.
   */
  static async scanForInbound(trackingId: string, userId: string) {
    // 1. Get user warehouse
    const warehouseId = await getUserWarehouseId(userId);
    if (!warehouseId) {
      throw { code: 400, message: "User tidak terdaftar di gudang manapun. Hubungi administrator." };
    }

    // 2. Find order
    const [order] = await db
      .select()
      .from(stockOrders)
      .where(and(eq(stockOrders.trackingId, trackingId), isNull(stockOrders.deletedAt)));

    if (!order) {
      throw { code: 404, message: `No. Resi '${trackingId}' tidak ditemukan di sistem.` };
    }

    // 3. Validate warehouse
    if (order.warehouseId !== warehouseId) {
      throw { code: 403, message: `No. Resi ini bukan untuk gudang Anda.` };
    }

    // 4. Validate status — harus PACKED atau SENDING
    if (!["PACKED", "SENDING"].includes(order.status)) {
      throw {
        code: 409,
        message: `Pesanan berstatus ${order.status}. Hanya pesanan PACKED atau SENDING yang bisa diretur.`,
        data: { status: order.status },
      };
    }

    // 5. Load item mappings dari outbound scan
    const mappedItems = await db
      .select({
        id: stockOrderItemMappings.id,
        itemId: stockOrderItemMappings.itemId,
        quantity: stockOrderItemMappings.quantity,
        isAutoRestockIfReturn: stockOrderItemMappings.isAutoRestockIfReturn,
        itemCode: items.code,
        itemName: items.name,
      })
      .from(stockOrderItemMappings)
      .innerJoin(items, eq(stockOrderItemMappings.itemId, items.id))
      .where(
        and(
          eq(stockOrderItemMappings.stockOrderId, order.id),
          isNull(stockOrderItemMappings.deletedAt)
        )
      );

    return {
      order: {
        id: order.id,
        trackingId: order.trackingId,
        orderId: order.orderId,
        status: order.status,
        purchaseChannel: order.purchaseChannel,
        recipient: order.recipient,
        sellerNote: order.sellerNote,
        warehouseId: order.warehouseId,
      },
      mappedItems,
    };
  }

  // ── PROCESS RETURN ─────────────────────────────────────────────────────────

  /**
   * Proses return inbound (parsial):
   * - Validasi order & warehouse
   * - Insert header stock_order_returns
   * - Insert setiap return item ke stock_order_return_items
   * - Restock inventory per item yang memiliki flag isAutoRestockIfReturn
   * - Update status order → RETURNED
   */
  static async processReturn(orderId: string, userId: string, payload: ProcessReturnPayload) {
    return await db.transaction(async (trx) => {
      // 1. Cek order
      const [order] = await trx
        .select()
        .from(stockOrders)
        .where(and(eq(stockOrders.id, orderId), isNull(stockOrders.deletedAt)))
        .for("update");

      if (!order) throw new Error("Order tidak ditemukan.");
      if (!["PACKED", "SENDING"].includes(order.status)) {
        throw new Error(`Order berstatus ${order.status}. Hanya PACKED atau SENDING yang bisa diretur.`);
      }

      // 2. Get user warehouse
      const warehouseId = await getUserWarehouseId(userId);
      if (!warehouseId) throw new Error("User tidak terdaftar di gudang manapun.");
      if (order.warehouseId !== warehouseId) throw new Error("Order ini bukan untuk gudang Anda.");

      // 3. Load mapping untuk lookup flag isAutoRestockIfReturn
      const mappings = await trx
        .select({
          itemId: stockOrderItemMappings.itemId,
          isAutoRestockIfReturn: stockOrderItemMappings.isAutoRestockIfReturn,
        })
        .from(stockOrderItemMappings)
        .where(
          and(
            eq(stockOrderItemMappings.stockOrderId, orderId),
            isNull(stockOrderItemMappings.deletedAt)
          )
        );

      const restockFlagMap = new Map(
        mappings.map((m) => [m.itemId, m.isAutoRestockIfReturn])
      );

      // 4. Insert return header
      const [returnHeader] = await trx
        .insert(stockOrderReturns)
        .values({
          stockOrderId: orderId,
          returnReason: payload.returnReason ?? null,
          proofImageUrl: payload.proofImageUrl,
          returnedBy: userId,
          createdBy: userId,
        } as StockOrderReturnInsert)
        .returning();

      // 5. Proses setiap item retur
      const returnItemInserts: StockOrderReturnItemInsert[] = [];

      // Optimize: gather items to restock
      const itemsToRestock = new Map<string, number>();
      for (const ri of payload.returnItems) {
        const itemId = ri.itemId ?? null;
        if (itemId !== null && restockFlagMap.get(itemId) === true) {
          itemsToRestock.set(itemId, (itemsToRestock.get(itemId) || 0) + ri.returnedQuantity);
        }
      }

      if (itemsToRestock.size > 0) {
        const restockItemIds = Array.from(itemsToRestock.keys());
        const stocks = await trx
          .select()
          .from(inventoryStocks)
          .where(
            and(
              eq(inventoryStocks.warehouseId, warehouseId),
              inArray(inventoryStocks.itemId, restockItemIds),
              isNull(inventoryStocks.deletedAt)
            )
          )
          .for("update");

        const stockMap = new Map(stocks.map(s => [s.itemId, s]));
        const insertPayloads = [];

        for (const [itemId, totalReturned] of itemsToRestock.entries()) {
          const stock = stockMap.get(itemId);
          if (stock) {
            await trx
              .update(inventoryStocks)
              .set({
                physicalQty: sql`${inventoryStocks.physicalQty} + ${totalReturned}`,
                availableQty: sql`${inventoryStocks.availableQty} + ${totalReturned}`,
                updatedAt: new Date(),
                updatedBy: userId,
              })
              .where(eq(inventoryStocks.id, stock.id));
          } else {
            insertPayloads.push({
              warehouseId,
              itemId: itemId,
              physicalQty: totalReturned.toString(),
              availableQty: totalReturned.toString(),
              reservedQty: "0",
              createdBy: userId,
            });
          }
        }

        if (insertPayloads.length > 0) {
          await trx.insert(inventoryStocks).values(insertPayloads);
        }
      }

      for (const ri of payload.returnItems) {
        const itemId = ri.itemId ?? null;
        const isRestocked = itemId !== null && (restockFlagMap.get(itemId) === true);

        returnItemInserts.push({
          stockOrderReturnId: returnHeader!.id,
          itemId: itemId,
          itemNameSnapshot: ri.itemNameSnapshot,
          returnedQuantity: ri.returnedQuantity.toString(),
          isRestocked,
          notes: ri.notes ?? null,
          createdBy: userId,
        });
      }
      // 6. Insert return items
      await trx.insert(stockOrderReturnItems).values(returnItemInserts);

      // 7. Update order status
      const [updated] = await trx
        .update(stockOrders)
        .set({
          status: "RETURNED",
          returnedBy: userId,
          returnedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(stockOrders.id, orderId))
        .returning();

      return { order: updated, returnId: returnHeader!.id };
    });
  }

  // ── PACK ORDER (legacy, kept for compatibility) ────────────────────────────

  static async packOrder(orderId: string, updatedBy: string) {
    return await db.transaction(async (trx) => {
      const order = await this.findById(orderId);
      if (!order) throw new Error("Order not found");
      if (order.status === "PACKED") throw new Error("Order already packed");

      // Optimize: batch retrieve inventory stocks for all items
      const itemIds = order.items.map(item => item.itemId);
      const uniqueItemIds = [...new Set(itemIds)];

      const stocks = uniqueItemIds.length > 0 ? await trx
        .select()
        .from(inventoryStocks)
        .where(
          and(
            eq(inventoryStocks.warehouseId, order.warehouseId),
            inArray(inventoryStocks.itemId, uniqueItemIds),
            isNull(inventoryStocks.deletedAt)
          )
        ) : [];

      const stockMap = new Map(stocks.map(s => [s.itemId, s]));

      // We also aggregate items quantities
      const aggregatedItems = new Map<string, number>();
      const itemNames = new Map<string, string>();
      for (const item of order.items) {
        aggregatedItems.set(item.itemId, (aggregatedItems.get(item.itemId) || 0) + Number(item.quantity));
        itemNames.set(item.itemId, item.itemName);
      }

      for (const [itemId, totalQty] of aggregatedItems.entries()) {
        const stock = stockMap.get(itemId);
        const itemName = itemNames.get(itemId);

        if (!stock) {
          throw new Error(`Item ${itemName} tidak memiliki stok di gudang terpilih.`);
        }
        if (Number(stock.availableQty) < totalQty) {
          throw new Error(
            `Stok available untuk item ${itemName} tidak mencukupi. Tersedia: ${stock.availableQty}, Dibutuhkan: ${totalQty}.`
          );
        }
      }

      // Update sequentially to bypass Promise.all in tx limitation
      for (const [itemId, totalQty] of aggregatedItems.entries()) {
        const stock = stockMap.get(itemId);
        if (stock) {
          await trx
            .update(inventoryStocks)
            .set({
              physicalQty: sql`${inventoryStocks.physicalQty} - ${totalQty}`,
              availableQty: sql`${inventoryStocks.availableQty} - ${totalQty}`,
              updatedAt: new Date(),
              updatedBy,
            })
            .where(eq(inventoryStocks.id, stock.id));
        }
      }

      const [updated] = await trx
        .update(stockOrders)
        .set({ status: "PACKED", updatedBy, updatedAt: new Date() })
        .where(eq(stockOrders.id, orderId))
        .returning();

      return updated;
    });
  }

  // ── RETURN ORDER (legacy, kept for compatibility) ──────────────────────────

  static async returnOrder(orderId: string, updatedBy: string) {
    return await db.transaction(async (trx) => {
      const order = await this.findById(orderId);
      if (!order) throw new Error("Order not found");
      if (order.status === "RETURNED") throw new Error("Order already returned");

      // Optimize: batch retrieve inventory stocks for all items
      const itemIds = order.items.map(item => item.itemId);
      const uniqueItemIds = [...new Set(itemIds)];

      const stocks = uniqueItemIds.length > 0 ? await trx
        .select()
        .from(inventoryStocks)
        .where(
          and(
            eq(inventoryStocks.warehouseId, order.warehouseId),
            inArray(inventoryStocks.itemId, uniqueItemIds),
            isNull(inventoryStocks.deletedAt)
          )
        ) : [];

      const stockMap = new Map(stocks.map(s => [s.itemId, s]));

      // We also aggregate items quantities for returning
      const aggregatedItems = new Map<string, number>();
      for (const item of order.items) {
        aggregatedItems.set(item.itemId, (aggregatedItems.get(item.itemId) || 0) + Number(item.quantity));
      }

      const insertPayloads = [];

      for (const [itemId, totalQty] of aggregatedItems.entries()) {
        const stock = stockMap.get(itemId);
        if (stock) {
          await trx
            .update(inventoryStocks)
            .set({
              physicalQty: sql`${inventoryStocks.physicalQty} + ${totalQty}`,
              availableQty: sql`${inventoryStocks.availableQty} + ${totalQty}`,
              updatedAt: new Date(),
              updatedBy,
            })
            .where(eq(inventoryStocks.id, stock.id));
        } else {
          insertPayloads.push({
            warehouseId: order.warehouseId,
            itemId: itemId,
            physicalQty: totalQty.toString(),
            availableQty: totalQty.toString(),
            reservedQty: "0",
          });
        }
      }

      if (insertPayloads.length > 0) {
        await trx.insert(inventoryStocks).values(insertPayloads);
      }

      const [updated] = await trx
        .update(stockOrders)
        .set({ status: "RETURNED", type: "INBOUND", updatedBy, updatedAt: new Date() })
        .where(eq(stockOrders.id, orderId))
        .returning();

      return updated;
    });
  }
}
