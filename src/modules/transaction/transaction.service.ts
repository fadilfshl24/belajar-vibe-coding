import { db } from "../../core/db";
import { TransactionModel } from "./transaction.model";
import { inventoryStocks } from "../inventory/inventory.schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import type { TransactionInsert, TransactionItemInsert } from "./transaction.schema";
import { purchaseRequests, purchaseRequestDetails } from "../purchase-request/purchase-request.schema";

export class TransactionService {
  /**
   * Returns a Set of itemIds that are locked by an Approved Purchase Request at the given warehouse.
   */
  static async areStocksLocked(warehouseId: string, itemIds: string[]): Promise<Set<string>> {
    if (!itemIds.length) return new Set();
    const dedupedItemIds = [...new Set(itemIds)];

    const lockedPRs = await db
      .select({ itemId: purchaseRequestDetails.itemId })
      .from(purchaseRequests)
      .innerJoin(
        purchaseRequestDetails,
        eq(purchaseRequestDetails.purchaseRequestId, purchaseRequests.id)
      )
      .where(
        and(
          eq(purchaseRequests.warehouseId, warehouseId),
          eq(purchaseRequests.status, 2), // Approved
          inArray(purchaseRequestDetails.itemId, dedupedItemIds),
          isNull(purchaseRequests.deletedAt),
          isNull(purchaseRequestDetails.deletedAt)
        )
      );

    return new Set(lockedPRs.map(pr => String(pr.itemId)));
  }

  /**
   * Returns true if the given item at the given warehouse is locked by an Approved Purchase Request.
   * Only Superadmin can override a locked stock.
   */
  static async isStockLocked(warehouseId: string, itemId: string): Promise<boolean> {
    const lockedSet = await TransactionService.areStocksLocked(warehouseId, [itemId]);
    return lockedSet.has(itemId);
  }

  static async completeTransaction(transactionId: string, userId?: string, isSuperadmin = false) {
    const txData = await TransactionModel.findById(transactionId);
    if (!txData) throw new Error("Transaction not found");
    if (txData.status !== "DRAFT") throw new Error("Only DRAFT transactions can be completed");

    // Stock Locking: non-superadmin cannot modify OUT transactions on locked stocks
    if (txData.type === "OUT" && !isSuperadmin) {
      const itemIdsToCheck = txData.items.map(item => item.itemId);
      if (itemIdsToCheck.length > 0) {
        const lockedSet = await TransactionService.areStocksLocked(txData.warehouseId, itemIdsToCheck);
        for (const item of txData.items) {
          if (lockedSet.has(item.itemId)) {
            throw new Error(`Stok untuk item ${item.itemId} sedang dikunci oleh Purchase Request yang telah disetujui. Hanya Superadmin yang dapat mengubah stok ini.`);
          }
        }
      }
    }

    await db.transaction(async (tx) => {
      const itemIds = txData.items.map((item) => item.itemId);
      const stocks = itemIds.length > 0
        ? await tx
            .select()
            .from(inventoryStocks)
            .where(
              and(
                eq(inventoryStocks.warehouseId, txData.warehouseId),
                inArray(inventoryStocks.itemId, itemIds)
              )
            )
        : [];
      const stockMap = new Map(stocks.map((s) => [s.itemId, s]));

      const insertPayloads = [];
      const stockUpdates = new Map<string, { id: string, physicalQty: number, availableQty: number }>();

      // Pre-aggregate quantities to handle duplicate itemIds in the same transaction cleanly
      const aggregatedItems = new Map<string, number>();
      for (const item of txData.items) {
        const currentQty = aggregatedItems.get(item.itemId) || 0;
        aggregatedItems.set(item.itemId, currentQty + Number(item.quantity));
      }

      for (const [itemId, qty] of aggregatedItems.entries()) {
        const stock = stockMap.get(itemId);

        if (txData.type === "IN") {
          if (stock) {
            const currentUpdate = stockUpdates.get(itemId) || {
              id: stock.id,
              physicalQty: Number(stock.physicalQty),
              availableQty: Number(stock.availableQty)
            };
            currentUpdate.physicalQty += qty;
            currentUpdate.availableQty += qty;
            stockUpdates.set(itemId, currentUpdate);
          } else {
            insertPayloads.push({
              warehouseId: txData.warehouseId,
              itemId: itemId,
              physicalQty: qty.toString(),
              availableQty: qty.toString(),
              reservedQty: "0.00",
              createdBy: userId,
              updatedBy: userId,
            });
          }
        } else if (txData.type === "OUT") {
          if (!stock || Number(stock.physicalQty) < qty) {
            throw new Error(`Insufficient stock for item ${itemId}`);
          }

          const currentUpdate = stockUpdates.get(itemId) || {
            id: stock.id,
            physicalQty: Number(stock.physicalQty),
            availableQty: Number(stock.availableQty)
          };
          currentUpdate.physicalQty -= qty;
          currentUpdate.availableQty -= qty;
          stockUpdates.set(itemId, currentUpdate);
        }
      }

      if (insertPayloads.length > 0) {
        await tx.insert(inventoryStocks).values(insertPayloads);
      }

      if (stockUpdates.size > 0) {
        const sqlChunksPhysical: any[] = [];
        const sqlChunksAvailable: any[] = [];
        const updateIds: string[] = [];

        sqlChunksPhysical.push(sql`(case`);
        sqlChunksAvailable.push(sql`(case`);

        for (const [itemId, update] of stockUpdates.entries()) {
          updateIds.push(update.id);
          sqlChunksPhysical.push(sql`when ${inventoryStocks.id} = ${update.id} then ${update.physicalQty.toString()}`);
          sqlChunksAvailable.push(sql`when ${inventoryStocks.id} = ${update.id} then ${update.availableQty.toString()}`);
        }

        sqlChunksPhysical.push(sql`end)`);
        sqlChunksAvailable.push(sql`end)`);

        await tx.update(inventoryStocks)
          .set({
            physicalQty: sql.join(sqlChunksPhysical, sql` `),
            availableQty: sql.join(sqlChunksAvailable, sql` `),
            updatedAt: new Date(),
            updatedBy: userId
          })
          .where(inArray(inventoryStocks.id, updateIds));
      }

      // Update status
      await TransactionModel.updateStatus(transactionId, "COMPLETED", userId);
    });
  }

  static async approveCancellation(approvalId: string, approvedBy: string, status: "APPROVED" | "REJECTED", responseRemark?: string) {
    const approval = await TransactionModel.processCancelApproval(approvalId, status, approvedBy, responseRemark);

    if (status === "APPROVED") {
      // Revert stock
      const txData = await TransactionModel.findById(approval.transactionId);
      if (!txData) return;

      await db.transaction(async (tx) => {
        const itemIds = txData.items.map((item) => item.itemId);
        const stocks = itemIds.length > 0
          ? await tx
              .select()
              .from(inventoryStocks)
              .where(
                and(
                  eq(inventoryStocks.warehouseId, txData.warehouseId),
                  inArray(inventoryStocks.itemId, itemIds)
                )
              )
          : [];
        const stockMap = new Map(stocks.map((s) => [s.itemId, s]));

        const stockUpdates = new Map<string, { id: string, physicalQty: number, availableQty: number }>();

        for (const item of txData.items) {
          let stock = stockMap.get(item.itemId);

          if (stock) {
            const qty = Number(item.quantity);
            const currentUpdate = stockUpdates.get(item.itemId) || {
              id: stock.id,
              physicalQty: Number(stock.physicalQty),
              availableQty: Number(stock.availableQty)
            };

            if (txData.type === "IN") {
              // Revert IN -> subtract
              currentUpdate.physicalQty -= qty;
              currentUpdate.availableQty -= qty;
            } else {
              // Revert OUT -> add
              currentUpdate.physicalQty += qty;
              currentUpdate.availableQty += qty;
            }

            stockUpdates.set(item.itemId, currentUpdate);
            // Mutate stockMap for subsequent items
            stock.physicalQty = currentUpdate.physicalQty.toString();
            stock.availableQty = currentUpdate.availableQty.toString();
          }
        }

        if (stockUpdates.size > 0) {
          const sqlChunksPhysical: any[] = [];
          const sqlChunksAvailable: any[] = [];
          const updateIds: string[] = [];

          sqlChunksPhysical.push(sql`(case`);
          sqlChunksAvailable.push(sql`(case`);

          for (const [itemId, update] of stockUpdates.entries()) {
            updateIds.push(update.id);
            sqlChunksPhysical.push(sql`when ${inventoryStocks.id} = ${update.id} then ${update.physicalQty.toString()}`);
            sqlChunksAvailable.push(sql`when ${inventoryStocks.id} = ${update.id} then ${update.availableQty.toString()}`);
          }

          sqlChunksPhysical.push(sql`end)`);
          sqlChunksAvailable.push(sql`end)`);

          await tx.update(inventoryStocks)
            .set({
              physicalQty: sql.join(sqlChunksPhysical, sql` `),
              availableQty: sql.join(sqlChunksAvailable, sql` `),
              updatedAt: new Date(),
              updatedBy: approvedBy
            })
            .where(inArray(inventoryStocks.id, updateIds));
        }
      });
    }
  }
}

