import { db } from "../../core/db";
import { TransactionModel } from "./transaction.model";
import { inventoryStocks } from "../inventory/inventory.schema";
import { eq, and, inArray } from "drizzle-orm";
import type { TransactionInsert, TransactionItemInsert } from "./transaction.schema";

export class TransactionService {
  static async completeTransaction(transactionId: string, userId?: string) {
    const txData = await TransactionModel.findById(transactionId);
    if (!txData) throw new Error("Transaction not found");
    if (txData.status !== "DRAFT") throw new Error("Only DRAFT transactions can be completed");

    await db.transaction(async (tx) => {
      // ⚡ Bolt: Fetch all relevant inventory stocks in a single batch query (O(1)) instead of N queries
      const itemIds = txData.items.map((i) => i.itemId);
      const existingStocks = itemIds.length > 0
        ? await tx
            .select()
            .from(inventoryStocks)
            .where(and(
              eq(inventoryStocks.warehouseId, txData.warehouseId),
              inArray(inventoryStocks.itemId, itemIds)
            ))
        : [];

      // Create a map and a local tracking map to handle duplicate items accurately in memory
      const stockMap = new Map(existingStocks.map((s) => [s.itemId, s]));
      const updatedStockMap = new Map<string, number>();

      const operations = [];

      for (const item of txData.items) {
        const stock = stockMap.get(item.itemId);
        // Track the current quantity in memory to avoid overwrite issues with duplicate items
        let currentQty = updatedStockMap.has(item.itemId) ? updatedStockMap.get(item.itemId)! : (stock ? Number(stock.quantity) : 0);
        const qty = Number(item.quantity);

        if (txData.type === "IN") {
          currentQty += qty;
          updatedStockMap.set(item.itemId, currentQty);

          if (stock) {
            operations.push(
              tx
                .update(inventoryStocks)
                .set({
                  quantity: currentQty.toString(),
                  updatedAt: new Date(),
                  updatedBy: userId
                })
                .where(eq(inventoryStocks.id, stock.id))
            );
          } else {
            operations.push(
              tx.insert(inventoryStocks).values({
                warehouseId: txData.warehouseId,
                itemId: item.itemId,
                quantity: currentQty.toString(),
                createdBy: userId,
                updatedBy: userId,
              })
            );
          }
        } else if (txData.type === "OUT") {
          if (!stock || currentQty < qty) {
            throw new Error(`Insufficient stock for item ${item.itemId}`);
          }
          currentQty -= qty;
          updatedStockMap.set(item.itemId, currentQty);

          operations.push(
            tx
              .update(inventoryStocks)
              .set({
                quantity: currentQty.toString(),
                updatedAt: new Date(),
                updatedBy: userId
              })
              .where(eq(inventoryStocks.id, stock.id))
          );
        }
      }

      // ⚡ Bolt: Execute all update operations concurrently
      await Promise.all(operations);

      // Update status
      await txData.status;
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
        // ⚡ Bolt: Fetch all relevant inventory stocks in a single batch query (O(1)) instead of N queries
        const itemIds = txData.items.map((i) => i.itemId);
        const existingStocks = itemIds.length > 0
          ? await tx
              .select()
              .from(inventoryStocks)
              .where(and(
                eq(inventoryStocks.warehouseId, txData.warehouseId),
                inArray(inventoryStocks.itemId, itemIds)
              ))
          : [];

        // Track the current quantity in memory to handle duplicate items accurately
        const stockMap = new Map(existingStocks.map((s) => [s.itemId, s]));
        const updatedStockMap = new Map<string, number>();
        const operations = [];

        for (const item of txData.items) {
          const stock = stockMap.get(item.itemId);
          
          if (stock) {
            let currentQty = updatedStockMap.has(item.itemId) ? updatedStockMap.get(item.itemId)! : Number(stock.quantity);
            const qty = Number(item.quantity);

            if (txData.type === "IN") {
              // Revert IN -> subtract
              currentQty -= qty;
              updatedStockMap.set(item.itemId, currentQty);

              operations.push(
                tx
                  .update(inventoryStocks)
                  .set({
                    quantity: currentQty.toString(),
                    updatedAt: new Date(),
                    updatedBy: approvedBy
                  })
                  .where(eq(inventoryStocks.id, stock.id))
              );
            } else {
              // Revert OUT -> add
              currentQty += qty;
              updatedStockMap.set(item.itemId, currentQty);

              operations.push(
                tx
                  .update(inventoryStocks)
                  .set({
                    quantity: currentQty.toString(),
                    updatedAt: new Date(),
                    updatedBy: approvedBy
                  })
                  .where(eq(inventoryStocks.id, stock.id))
              );
            }
          }
        }

        // ⚡ Bolt: Execute all update operations concurrently
        await Promise.all(operations);
      });
    }
  }
}
