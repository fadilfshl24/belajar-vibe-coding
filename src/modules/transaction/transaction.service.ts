import { db } from "../../core/db";
import { TransactionModel } from "./transaction.model";
import { inventoryStocks } from "../inventory/inventory.schema";
import { eq, and } from "drizzle-orm";
import type { TransactionInsert, TransactionItemInsert } from "./transaction.schema";

export class TransactionService {
  static async completeTransaction(transactionId: string, userId?: string) {
    const txData = await TransactionModel.findById(transactionId);
    if (!txData) throw new Error("Transaction not found");
    if (txData.status !== "DRAFT") throw new Error("Only DRAFT transactions can be completed");

    await db.transaction(async (tx) => {
      // Process items
      for (const item of txData.items) {
        const [stock] = await tx
          .select()
          .from(inventoryStocks)
          .where(and(eq(inventoryStocks.warehouseId, txData.warehouseId), eq(inventoryStocks.itemId, item.itemId)))
          .limit(1);

        const qty = Number(item.quantity);

        if (txData.type === "IN") {
          if (stock) {
            await tx
              .update(inventoryStocks)
              .set({ 
                quantity: (Number(stock.quantity) + qty).toString(), 
                updatedAt: new Date(),
                updatedBy: userId
              })
              .where(eq(inventoryStocks.id, stock.id));
          } else {
            await tx.insert(inventoryStocks).values({
              warehouseId: txData.warehouseId,
              itemId: item.itemId,
              quantity: qty.toString(),
              createdBy: userId,
              updatedBy: userId,
            });
          }
        } else if (txData.type === "OUT") {
          if (!stock || Number(stock.quantity) < qty) {
            throw new Error(`Insufficient stock for item ${item.itemId}`);
          }
          await tx
            .update(inventoryStocks)
            .set({ 
              quantity: (Number(stock.quantity) - qty).toString(), 
              updatedAt: new Date(),
              updatedBy: userId
            })
            .where(eq(inventoryStocks.id, stock.id));
        }
      }

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
        for (const item of txData.items) {
          const [stock] = await tx
            .select()
            .from(inventoryStocks)
            .where(and(eq(inventoryStocks.warehouseId, txData.warehouseId), eq(inventoryStocks.itemId, item.itemId)))
            .limit(1);
          
          if (stock) {
            const qty = Number(item.quantity);
            if (txData.type === "IN") {
              // Revert IN -> subtract
              await tx
                .update(inventoryStocks)
                .set({ 
                  quantity: (Number(stock.quantity) - qty).toString(), 
                  updatedAt: new Date(),
                  updatedBy: approvedBy
                })
                .where(eq(inventoryStocks.id, stock.id));
            } else {
              // Revert OUT -> add
              await tx
                .update(inventoryStocks)
                .set({ 
                  quantity: (Number(stock.quantity) + qty).toString(), 
                  updatedAt: new Date(),
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
