import { db } from "../../core/db";
import { stockOrders, stockOrderItems, type StockOrderInsert, type StockOrderItemInsert } from "./stock-order.schema";
import { eq, and, isNull, desc, ilike, or, inArray, sql } from "drizzle-orm";
import { items } from "../item/item.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { inventoryStocks } from "../inventory/inventory.schema";

interface FindAllOptions {
  page: number;
  limit: number;
  warehouseId?: string;
  warehouseIds?: string[];
  search?: string;
  status?: "UNPACKED" | "PACKED" | "RETURNED";
  type?: "INBOUND" | "OUTBOUND";
  purchaseChannel?: string;
}

export class StockOrderModel {
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
        address: stockOrders.address,
        sellerNote: stockOrders.sellerNote,
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

  static async findByTrackingId(trackingId: string, type?: "INBOUND" | "OUTBOUND") {
    const conditions = [eq(stockOrders.trackingId, trackingId), isNull(stockOrders.deletedAt)];
    if (type) conditions.push(eq(stockOrders.type, type));

    const [order] = await db.select().from(stockOrders).where(and(...conditions));
    if (!order) return null;
    return this.findById(order.id);
  }

  static async findAll(opts: FindAllOptions) {
    const offset = (opts.page - 1) * opts.limit;
    const conditions = [isNull(stockOrders.deletedAt)];

    if (opts.warehouseId) {
      conditions.push(eq(stockOrders.warehouseId, opts.warehouseId));
    } else if (opts.warehouseIds && opts.warehouseIds.length > 0) {
      conditions.push(inArray(stockOrders.warehouseId, opts.warehouseIds));
    }
    if (opts.status) conditions.push(eq(stockOrders.status, opts.status));
    if (opts.type) conditions.push(eq(stockOrders.type, opts.type));
    if (opts.purchaseChannel) conditions.push(eq(stockOrders.purchaseChannel, opts.purchaseChannel));
    
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
        recipient: stockOrders.recipient,
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

  static async packOrder(orderId: string, updatedBy: string) {
    return await db.transaction(async (trx) => {
      // Get order details
      const order = await this.findById(orderId);
      if (!order) throw new Error("Order not found");
      if (order.status === "PACKED") throw new Error("Order already packed");
      
      // Update inventory for each item
      for (const item of order.items) {
        // Find existing inventory stock
        const [stock] = await trx
          .select()
          .from(inventoryStocks)
          .where(
            and(
              eq(inventoryStocks.warehouseId, order.warehouseId),
              eq(inventoryStocks.itemId, item.itemId),
              isNull(inventoryStocks.deletedAt)
            )
          );

        if (!stock) {
          throw new Error(`Item ${item.itemName} tidak memiliki stok di gudang terpilih.`);
        }
        if (Number(stock.availableQty) < Number(item.quantity)) {
          throw new Error(`Stok available untuk ${item.itemName} tidak mencukupi.`);
        }

        // Reduce physical and available qty
        await trx
          .update(inventoryStocks)
          .set({
            physicalQty: sql`${inventoryStocks.physicalQty} - ${item.quantity}`,
            availableQty: sql`${inventoryStocks.availableQty} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(inventoryStocks.id, stock.id));
      }

      // Update order status
      const [updated] = await trx
        .update(stockOrders)
        .set({ status: "PACKED", updatedBy, updatedAt: new Date() })
        .where(eq(stockOrders.id, orderId))
        .returning();

      return updated;
    });
  }

  static async returnOrder(orderId: string, updatedBy: string) {
    return await db.transaction(async (trx) => {
      // Get order details
      const order = await this.findById(orderId);
      if (!order) throw new Error("Order not found");
      if (order.status === "RETURNED") throw new Error("Order already returned");

      // We assume returning adds back physical and available stock
      for (const item of order.items) {
        // Find or create inventory stock
        const [stock] = await trx
          .select()
          .from(inventoryStocks)
          .where(
            and(
              eq(inventoryStocks.warehouseId, order.warehouseId),
              eq(inventoryStocks.itemId, item.itemId),
              isNull(inventoryStocks.deletedAt)
            )
          );

        if (stock) {
          await trx
            .update(inventoryStocks)
            .set({
              physicalQty: sql`${inventoryStocks.physicalQty} + ${item.quantity}`,
              availableQty: sql`${inventoryStocks.availableQty} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(inventoryStocks.id, stock.id));
        } else {
          // Create new stock entry if it doesn't exist
          await trx.insert(inventoryStocks).values({
            warehouseId: order.warehouseId,
            itemId: item.itemId,
            physicalQty: item.quantity.toString(),
            availableQty: item.quantity.toString(),
            reservedQty: "0",
          });
        }
      }

      // Update order status
      const [updated] = await trx
        .update(stockOrders)
        .set({ status: "RETURNED", type: "INBOUND", updatedBy, updatedAt: new Date() })
        .where(eq(stockOrders.id, orderId))
        .returning();

      return updated;
    });
  }
}
