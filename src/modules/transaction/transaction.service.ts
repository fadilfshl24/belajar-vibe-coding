import { db } from "../../core/db";
import { TransactionModel } from "./transaction.model";
import { inventoryStocks } from "../inventory/inventory.schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
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

      for (const item of txData.items) {
        const stock = stockMap.get(item.itemId);
        const qty = Number(item.quantity);

        if (txData.type === "IN") {
          if (stock) {
            await tx
              .update(inventoryStocks)
              .set({
                physicalQty: (Number(stock.physicalQty) + qty).toString(),
                availableQty: (Number(stock.availableQty) + qty).toString(),
                updatedAt: new Date(),
                updatedBy: userId
              })
              .where(eq(inventoryStocks.id, stock.id));
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
        } else if (txData.type === "OUT") {
          if (!stock || Number(stock.physicalQty) < qty) {
            throw new Error(`Insufficient stock for item ${item.itemId}`);
          }
          await tx
            .update(inventoryStocks)
            .set({
              physicalQty: (Number(stock.physicalQty) - qty).toString(),
              availableQty: (Number(stock.availableQty) - qty).toString(),
              updatedAt: new Date(),
              updatedBy: userId
            })
            .where(eq(inventoryStocks.id, stock.id));
        }
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

        for (const item of txData.items) {
          const stock = stockMap.get(item.itemId);

          if (stock) {
            const qty = Number(item.quantity);
            if (txData.type === "IN") {
              // Revert IN -> subtract
              await tx
                .update(inventoryStocks)
                .set({
                  physicalQty: (Number(stock.physicalQty) - qty).toString(),
                  availableQty: (Number(stock.availableQty) - qty).toString(),
                  updatedAt: new Date(),
                  updatedBy: approvedBy
                })
                .where(eq(inventoryStocks.id, stock.id));
            } else {
              // Revert OUT -> add
              await tx
                .update(inventoryStocks)
                .set({
                  physicalQty: (Number(stock.physicalQty) + qty).toString(),
                  availableQty: (Number(stock.availableQty) + qty).toString(),
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

