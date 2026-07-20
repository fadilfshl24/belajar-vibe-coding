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
      // ⚡ Bolt Optimization: Batch fetch stocks to avoid N+1 queries
      const itemIds = txData.items.map(item => item.itemId);
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
      const stockMap = new Map(stocks.map(s => [s.itemId, s]));

      const insertPayloads = [];
      const updatePromises = [];

      for (const item of txData.items) {
        const stock = stockMap.get(item.itemId);
        const qty = Number(item.quantity);

        if (txData.type === "IN") {
          currentQty += qty;
          updatedStockMap.set(item.itemId, currentQty);

          if (stock) {
            updatePromises.push(
              tx.update(inventoryStocks)
                .set({
                  quantity: (Number(stock.quantity) + qty).toString(),
                  updatedAt: new Date(),
                  updatedBy: userId
                })
                .where(eq(inventoryStocks.id, stock.id))
            );
          } else {
            insertPayloads.push({
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
          updatePromises.push(
            tx.update(inventoryStocks)
              .set({
                quantity: (Number(stock.quantity) - qty).toString(),
                updatedAt: new Date(),
                updatedBy: userId
              })
              .where(eq(inventoryStocks.id, stock.id))
          );
        }
      }

      // ⚡ Bolt Optimization: Batch insert and parallel updates
      if (insertPayloads.length > 0) {
        await tx.insert(inventoryStocks).values(insertPayloads);
      }
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
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
        // ⚡ Bolt Optimization: Batch fetch stocks to avoid N+1 queries
        const itemIds = txData.items.map(item => item.itemId);
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
        const stockMap = new Map(stocks.map(s => [s.itemId, s]));

        const updatePromises = [];

        for (const item of txData.items) {
          const stock = stockMap.get(item.itemId);
          
          if (stock) {
            if (txData.type === "IN") {
              // Revert IN -> subtract
              updatePromises.push(
                tx.update(inventoryStocks)
                  .set({
                    quantity: (Number(stock.quantity) - qty).toString(),
                    updatedAt: new Date(),
                    updatedBy: approvedBy
                  })
                  .where(eq(inventoryStocks.id, stock.id))
              );
            } else {
              // Revert OUT -> add
              updatePromises.push(
                tx.update(inventoryStocks)
                  .set({
                    quantity: (Number(stock.quantity) + qty).toString(),
                    updatedAt: new Date(),
                    updatedBy: approvedBy
                  })
                  .where(eq(inventoryStocks.id, stock.id))
              );
            }
          }
        }

        // ⚡ Bolt Optimization: Parallelize updates
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }
      });
    }
  }
}
