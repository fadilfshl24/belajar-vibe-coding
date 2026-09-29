import { db } from "../../core/db";
import { TransactionModel } from "./transaction.model";
import { inventoryStocks } from "../inventory/inventory.schema";
import { eq, and, isNull, inArray, sql, type SQL } from "drizzle-orm";
import type { TransactionInsert, TransactionItemInsert } from "./transaction.schema";
import { purchaseRequests, purchaseRequestDetails } from "../purchase-request/purchase-request.schema";

export class TransactionService {
  /**
   * Returns true if the given item at the given warehouse is locked by an Approved Purchase Request.
   * Only Superadmin can override a locked stock.
   */
  static async isStockLocked(warehouseId: string, itemId: string): Promise<boolean> {
    const lockedPR = await db
      .select({ id: purchaseRequests.id })
      .from(purchaseRequests)
      .innerJoin(
        purchaseRequestDetails,
        eq(purchaseRequestDetails.purchaseRequestId, purchaseRequests.id)
      )
      .where(
        and(
          eq(purchaseRequests.warehouseId, warehouseId),
          eq(purchaseRequests.status, 2), // Approved
          eq(purchaseRequestDetails.itemId, itemId),
          isNull(purchaseRequests.deletedAt),
          isNull(purchaseRequestDetails.deletedAt)
        )
      )
      .limit(1);

    return lockedPR.length > 0;
  }

  static async completeTransaction(transactionId: string, userId?: string, isSuperadmin = false) {
    const txData = await TransactionModel.findById(transactionId);
    if (!txData) throw new Error("Transaction not found");
    if (txData.status !== "DRAFT") throw new Error("Only DRAFT transactions can be completed");

    // Stock Locking: non-superadmin cannot modify OUT transactions on locked stocks
    if (txData.type === "OUT" && !isSuperadmin) {
      for (const item of txData.items) {
        const locked = await TransactionService.isStockLocked(txData.warehouseId, item.itemId);
        if (locked) {
          throw new Error(`Stok untuk item ${item.itemId} sedang dikunci oleh Purchase Request yang telah disetujui. Hanya Superadmin yang dapat mengubah stok ini.`);
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

      const updateIds: string[] = [];
      const physicalQtyCases: SQL[] = [sql`CASE ${inventoryStocks.id}`];
      const availableQtyCases: SQL[] = [sql`CASE ${inventoryStocks.id}`];

      for (const item of txData.items) {
        const stock = stockMap.get(item.itemId);
        const qty = Number(item.quantity);

        if (txData.type === "IN") {
          if (stock) {
            // Aggregate in-memory state in case of multiple same items
            stock.physicalQty = (Number(stock.physicalQty) + qty).toString();
            stock.availableQty = (Number(stock.availableQty) + qty).toString();

            if (!updateIds.includes(stock.id)) {
              updateIds.push(stock.id);
            }
          } else {
            // If multiple of same item, ideally we should also aggregate in insertPayloads,
            // but assuming unique items per transaction for now, or we can aggregate inserts too.
            const existingInsert = insertPayloads.find(p => p.itemId === item.itemId);
            if (existingInsert) {
               existingInsert.physicalQty = (Number(existingInsert.physicalQty) + qty).toString();
               existingInsert.availableQty = (Number(existingInsert.availableQty) + qty).toString();
            } else {
               insertPayloads.push({
                 warehouseId: txData.warehouseId,
                 itemId: item.itemId,
                 physicalQty: qty.toString(),
                 availableQty: qty.toString(),
                 reservedQty: "0.00",
                 createdBy: userId,
                 updatedBy: userId,
               });
            }
          }
        } else if (txData.type === "OUT") {
          if (!stock || Number(stock.physicalQty) < qty) {
            throw new Error(`Insufficient stock for item ${item.itemId}`);
          }
          // Aggregate in-memory state
          stock.physicalQty = (Number(stock.physicalQty) - qty).toString();
          stock.availableQty = (Number(stock.availableQty) - qty).toString();

          if (!updateIds.includes(stock.id)) {
            updateIds.push(stock.id);
          }
        }
      }

      // Build SQL CASES after all in-memory aggregation is done
      for (const id of updateIds) {
         const stock = stocks.find(s => s.id === id);
         if (stock) {
           physicalQtyCases.push(sql`WHEN ${id} THEN ${stock.physicalQty}`);
           availableQtyCases.push(sql`WHEN ${id} THEN ${stock.availableQty}`);
         }
      }

      if (updateIds.length > 0) {
        physicalQtyCases.push(sql`ELSE ${inventoryStocks.physicalQty} END`);
        availableQtyCases.push(sql`ELSE ${inventoryStocks.availableQty} END`);

        await tx
          .update(inventoryStocks)
          .set({
            physicalQty: sql.join(physicalQtyCases, sql` `),
            availableQty: sql.join(availableQtyCases, sql` `),
            updatedAt: new Date(),
            updatedBy: userId
          })
          .where(inArray(inventoryStocks.id, updateIds));
      }

      if (insertPayloads.length > 0) {
        await tx.insert(inventoryStocks).values(insertPayloads);
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

        const updateIds: string[] = [];
        const physicalQtyCases: SQL[] = [sql`CASE ${inventoryStocks.id}`];
        const availableQtyCases: SQL[] = [sql`CASE ${inventoryStocks.id}`];

        for (const item of txData.items) {
          const stock = stockMap.get(item.itemId);

          if (stock) {
            const qty = Number(item.quantity);
            if (txData.type === "IN") {
              // Revert IN -> subtract
              stock.physicalQty = (Number(stock.physicalQty) - qty).toString();
              stock.availableQty = (Number(stock.availableQty) - qty).toString();
            } else {
              // Revert OUT -> add
              stock.physicalQty = (Number(stock.physicalQty) + qty).toString();
              stock.availableQty = (Number(stock.availableQty) + qty).toString();
            }
            if (!updateIds.includes(stock.id)) {
              updateIds.push(stock.id);
            }
          }
        }

        // Build SQL CASES after all in-memory aggregation is done
        for (const id of updateIds) {
           const stock = stocks.find(s => s.id === id);
           if (stock) {
             physicalQtyCases.push(sql`WHEN ${id} THEN ${stock.physicalQty}`);
             availableQtyCases.push(sql`WHEN ${id} THEN ${stock.availableQty}`);
           }
        }

        if (updateIds.length > 0) {
          physicalQtyCases.push(sql`ELSE ${inventoryStocks.physicalQty} END`);
          availableQtyCases.push(sql`ELSE ${inventoryStocks.availableQty} END`);

          await tx
            .update(inventoryStocks)
            .set({
              physicalQty: sql.join(physicalQtyCases, sql` `),
              availableQty: sql.join(availableQtyCases, sql` `),
              updatedAt: new Date(),
              updatedBy: approvedBy
            })
            .where(inArray(inventoryStocks.id, updateIds));
        }
      });
    }
  }
}

