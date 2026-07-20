import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "../../core/db";
import { assemblyOrders, assemblyOrderDetails, assemblyOrderComponents } from "./assembly-order.schema";
import { itemPackageDetails, items } from "../item/item.schema";
import { inventoryStocks } from "../inventory/inventory.schema";
import { transactions, transactionItems } from "../transaction/transaction.schema";
import type { ICreateAssemblyOrder } from "./assembly-order.dto";

export class AssemblyOrderService {
  static async create(input: ICreateAssemblyOrder, userId: string) {
    return await db.transaction(async (tx) => {
      // 1. Generate code
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
      const prefix = `AO-${dateStr}-`;

      const lastRecord = await tx.query.assemblyOrders.findFirst({
        where: and(
          isNull(assemblyOrders.deletedAt),
          sql`${assemblyOrders.code} LIKE ${prefix + "%"}`
        ),
        orderBy: (fields, { desc }) => [desc(fields.code)],
      });

      let nextNum = 1;
      if (lastRecord) {
        const numPart = lastRecord.code.replace(prefix, "");
        nextNum = parseInt(numPart, 10) + 1;
      }
      const code = `${prefix}${String(nextNum).padStart(4, "0")}`;

      // 2. Insert assembly order header
      const [order] = await tx
        .insert(assemblyOrders)
        .values({
          code,
          warehouseId: input.warehouseId,
          notes: input.notes || null,
          status: 1, // Pending Approval
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // 3. Process each produced item (finished good)
      for (const detail of input.details) {
        // Fetch BOM components for the package item using standard SQL joins
        const components = await tx
          .select({
            childItemId: itemPackageDetails.childItemId,
            quantity: itemPackageDetails.quantity,
            purchasePrice: items.purchasePrice,
          })
          .from(itemPackageDetails)
          .innerJoin(items, eq(itemPackageDetails.childItemId, items.id))
          .where(
            and(
              eq(itemPackageDetails.packageItemId, detail.itemId),
              eq(itemPackageDetails.isActive, true),
              isNull(itemPackageDetails.deletedAt)
            )
          );

        if (components.length === 0) {
          throw new Error(`Item ID ${detail.itemId} does not have component details (BOM) configured.`);
        }

        // Calculate HPP (unit cost)
        let unitCost = 0;
        for (const comp of components) {
          unitCost += Number(comp.purchasePrice) * Number(comp.quantity);
        }
        const totalCost = unitCost * detail.quantityProduced;

        // Insert assembly order detail
        const [orderDetail] = await tx
          .insert(assemblyOrderDetails)
          .values({
            assemblyOrderId: order.id,
            itemId: detail.itemId,
            quantityProduced: detail.quantityProduced.toString(),
            unitCost: unitCost.toString(),
            totalCost: totalCost.toString(),
            createdBy: userId,
            updatedBy: userId,
          })
          .returning();

        // 4. Insert components and lock/book stock
        for (const comp of components) {
          const qtyUsed = Number(comp.quantity) * detail.quantityProduced;

          await tx.insert(assemblyOrderComponents).values({
            assemblyOrderDetailId: orderDetail.id,
            componentItemId: comp.childItemId,
            quantityUsed: qtyUsed.toString(),
            quantityReturned: "0.0000",
            pricePerUnit: comp.purchasePrice.toString(),
            createdBy: userId,
            updatedBy: userId,
          });

          // Row locking (pessimistic) on inventory_stocks for the component
          let [stock] = await tx
            .select()
            .from(inventoryStocks)
            .where(
              and(
                eq(inventoryStocks.warehouseId, input.warehouseId),
                eq(inventoryStocks.itemId, comp.childItemId),
                isNull(inventoryStocks.deletedAt)
              )
            )
            .for("update");

          if (!stock) {
            // Create initial stock if it does not exist
            const [newStock] = await tx
              .insert(inventoryStocks)
              .values({
                warehouseId: input.warehouseId,
                itemId: comp.childItemId,
                physicalQty: "0.0000",
                reservedQty: "0.0000",
                availableQty: "0.0000",
                createdBy: userId,
                updatedBy: userId,
              })
              .returning();
            stock = newStock;
          }

          // Validate available stock before booking
          const currentAvailable = Number(stock.availableQty);
          if (currentAvailable < qtyUsed) {
            // Get item info for descriptive error
            const [itemInfo] = await tx.select({ name: items.name, code: items.code }).from(items).where(eq(items.id, comp.childItemId));
            throw new Error(`Insufficient stock for component ${itemInfo?.name || comp.childItemId} (${itemInfo?.code || ""}). Available: ${currentAvailable}, Needed: ${qtyUsed}`);
          }

          // Book stock atomically
          await tx
            .update(inventoryStocks)
            .set({
              availableQty: sql`${inventoryStocks.availableQty} - ${qtyUsed}`,
              reservedQty: sql`${inventoryStocks.reservedQty} + ${qtyUsed}`,
              updatedAt: new Date(),
              updatedBy: userId,
            })
            .where(eq(inventoryStocks.id, stock.id));
        }
      }

      return order;
    });
  }

  static async approve(id: string, userId: string) {
    return await db.transaction(async (tx) => {
      // 1. Fetch assembly order header
      const order = await tx.query.assemblyOrders.findFirst({
        where: and(eq(assemblyOrders.id, id), isNull(assemblyOrders.deletedAt)),
        with: {
          details: {
            where: isNull(assemblyOrderDetails.deletedAt),
            with: {
              components: {
                where: isNull(assemblyOrderComponents.deletedAt),
              },
            },
          },
        },
      });

      if (!order) {
        throw new Error("Assembly Order not found.");
      }

      if (order.status !== 1) {
        throw new Error("Assembly Order is not in pending status.");
      }

      // 2. Insert standard stock transaction record
      const [trx] = await tx
        .insert(transactions)
        .values({
          warehouseId: order.warehouseId,
          type: "OUT", // Standard out for raw materials
          referenceNumber: `TRX-AO-${order.code}`,
          description: `Auto-stock deduct from Assembly Order: ${order.code}`,
          status: "COMPLETED",
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // 3. Process each detail and component
      for (const detail of order.details) {
        // Add transaction item for finished goods (IN)
        const [trxIn] = await tx
          .insert(transactions)
          .values({
            warehouseId: order.warehouseId,
            type: "IN",
            referenceNumber: `TRX-AO-IN-${order.code}`,
            description: `Auto-stock entry from Assembly Order: ${order.code}`,
            status: "COMPLETED",
            createdBy: userId,
            updatedBy: userId,
          })
          .returning();

        await tx.insert(transactionItems).values({
          transactionId: trxIn.id,
          itemId: detail.itemId,
          quantity: detail.quantityProduced,
          createdBy: userId,
          updatedBy: userId,
        });

        // Add finished good stock to inventory
        let [fgStock] = await tx
          .select()
          .from(inventoryStocks)
          .where(
            and(
              eq(inventoryStocks.warehouseId, order.warehouseId),
              eq(inventoryStocks.itemId, detail.itemId),
              isNull(inventoryStocks.deletedAt)
            )
          )
          .for("update");

        if (!fgStock) {
          await tx.insert(inventoryStocks).values({
            warehouseId: order.warehouseId,
            itemId: detail.itemId,
            physicalQty: detail.quantityProduced,
            availableQty: detail.quantityProduced,
            reservedQty: "0.0000",
            createdBy: userId,
            updatedBy: userId,
          });
        } else {
          await tx
            .update(inventoryStocks)
            .set({
              physicalQty: sql`${inventoryStocks.physicalQty} + ${detail.quantityProduced}`,
              availableQty: sql`${inventoryStocks.availableQty} + ${detail.quantityProduced}`,
              updatedAt: new Date(),
              updatedBy: userId,
            })
            .where(eq(inventoryStocks.id, fgStock.id));
        }

        // Process components
        for (const comp of detail.components) {
          // Log component output transaction item
          await tx.insert(transactionItems).values({
            transactionId: trx.id,
            itemId: comp.componentItemId,
            quantity: comp.quantityUsed,
            createdBy: userId,
            updatedBy: userId,
          });

          // Lock stock row and deduct stock (release reservation & deduct physical stock)
          const [stock] = await tx
            .select()
            .from(inventoryStocks)
            .where(
              and(
                eq(inventoryStocks.warehouseId, order.warehouseId),
                eq(inventoryStocks.itemId, comp.componentItemId),
                isNull(inventoryStocks.deletedAt)
              )
            )
            .for("update");

          if (!stock) {
            throw new Error(`Inventory stock record not found for component Item ID ${comp.componentItemId}`);
          }

          // Deduct physical and reserved stock atomically
          await tx
            .update(inventoryStocks)
            .set({
              physicalQty: sql`${inventoryStocks.physicalQty} - ${comp.quantityUsed}`,
              reservedQty: sql`${inventoryStocks.reservedQty} - ${comp.quantityUsed}`,
              updatedAt: new Date(),
              updatedBy: userId,
            })
            .where(eq(inventoryStocks.id, stock.id));
        }
      }

      // 4. Update assembly order status
      const [updatedOrder] = await tx
        .update(assemblyOrders)
        .set({
          status: 2, // Approved
          approvedBy: userId,
          approvedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(assemblyOrders.id, id))
        .returning();

      return updatedOrder;
    });
  }

  static async reject(id: string, userId: string) {
    return await db.transaction(async (tx) => {
      // 1. Fetch assembly order header
      const order = await tx.query.assemblyOrders.findFirst({
        where: and(eq(assemblyOrders.id, id), isNull(assemblyOrders.deletedAt)),
        with: {
          details: {
            where: isNull(assemblyOrderDetails.deletedAt),
            with: {
              components: {
                where: isNull(assemblyOrderComponents.deletedAt),
              },
            },
          },
        },
      });

      if (!order) {
        throw new Error("Assembly Order not found.");
      }

      if (order.status !== 1) {
        throw new Error("Assembly Order is not in pending status.");
      }

      // 2. Release booked stock (subtract reservedQty and add availableQty)
      for (const detail of order.details) {
        for (const comp of detail.components) {
          const [stock] = await tx
            .select()
            .from(inventoryStocks)
            .where(
              and(
                eq(inventoryStocks.warehouseId, order.warehouseId),
                eq(inventoryStocks.itemId, comp.componentItemId),
                isNull(inventoryStocks.deletedAt)
              )
            )
            .for("update");

          if (stock) {
            await tx
              .update(inventoryStocks)
              .set({
                availableQty: sql`${inventoryStocks.availableQty} + ${comp.quantityUsed}`,
                reservedQty: sql`${inventoryStocks.reservedQty} - ${comp.quantityUsed}`,
                updatedAt: new Date(),
                updatedBy: userId,
              })
              .where(eq(inventoryStocks.id, stock.id));
          }
        }
      }

      // 3. Update assembly order status
      const [updatedOrder] = await tx
        .update(assemblyOrders)
        .set({
          status: 3, // Rejected
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(assemblyOrders.id, id))
        .returning();

      return updatedOrder;
    });
  }
}
