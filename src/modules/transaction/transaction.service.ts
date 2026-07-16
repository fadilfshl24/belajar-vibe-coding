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
      if (txData.items.length === 0) {
        await TransactionModel.updateStatus(transactionId, "COMPLETED", userId);
        return;
      }

      // Aggregate item quantities in case there are duplicate items in the transaction
      const itemQuantities = new Map<string, number>();
      for (const item of txData.items) {
        const currentQty = itemQuantities.get(item.itemId) || 0;
        itemQuantities.set(item.itemId, currentQty + Number(item.quantity));
      }

      const itemIds = Array.from(itemQuantities.keys());

      // Batch fetch all relevant stocks
      const stocks = await tx
        .select()
        .from(inventoryStocks)
        .where(
          and(
            eq(inventoryStocks.warehouseId, txData.warehouseId),
            inArray(inventoryStocks.itemId, itemIds)
          )
        );

      const stockMap = new Map(stocks.map(s => [s.itemId, s]));
      const now = new Date();

      // Process aggregated items
      for (const [itemId, qty] of itemQuantities.entries()) {
        const stock = stockMap.get(itemId);

        if (txData.type === "IN") {
          if (stock) {
            await tx
              .update(inventoryStocks)
              .set({ 
                quantity: (Number(stock.quantity) + qty).toString(), 
                updatedAt: now,
                updatedBy: userId
              })
              .where(eq(inventoryStocks.id, stock.id));
          } else {
            await tx.insert(inventoryStocks).values({
              warehouseId: txData.warehouseId,
              itemId: itemId,
              quantity: qty.toString(),
              createdBy: userId,
              updatedBy: userId,
            });
          }
        } else if (txData.type === "OUT") {
          if (!stock || Number(stock.quantity) < qty) {
            throw new Error(`Insufficient stock for item ${itemId}`);
          }
          await tx
            .update(inventoryStocks)
            .set({ 
              quantity: (Number(stock.quantity) - qty).toString(), 
              updatedAt: now,
              updatedBy: userId
            })
            .where(eq(inventoryStocks.id, stock.id));
        }
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
        if (txData.items.length === 0) return;

        // Aggregate item quantities
        const itemQuantities = new Map<string, number>();
        for (const item of txData.items) {
          const currentQty = itemQuantities.get(item.itemId) || 0;
          itemQuantities.set(item.itemId, currentQty + Number(item.quantity));
        }

        const itemIds = Array.from(itemQuantities.keys());

        // Batch fetch all relevant stocks
        const stocks = await tx
          .select()
          .from(inventoryStocks)
          .where(
            and(
              eq(inventoryStocks.warehouseId, txData.warehouseId),
              inArray(inventoryStocks.itemId, itemIds)
            )
          );

        const stockMap = new Map(stocks.map(s => [s.itemId, s]));
        const now = new Date();

        for (const [itemId, qty] of itemQuantities.entries()) {
          const stock = stockMap.get(itemId);
          
          if (stock) {
            if (txData.type === "IN") {
              // Revert IN -> subtract
              await tx
                .update(inventoryStocks)
                .set({ 
                  quantity: (Number(stock.quantity) - qty).toString(), 
                  updatedAt: now,
                  updatedBy: approvedBy
                })
                .where(eq(inventoryStocks.id, stock.id));
            } else {
              // Revert OUT -> add
              await tx
                .update(inventoryStocks)
                .set({ 
                  quantity: (Number(stock.quantity) + qty).toString(), 
                  updatedAt: now,
                  updatedBy: approvedBy
                })
                .where(eq(inventoryStocks.id, stock.id));
            }
          }
        }
      });
    }
  }
}
