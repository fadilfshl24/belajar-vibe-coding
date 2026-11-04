import { db } from "../../core/db";
import { TransactionModel } from "./transaction.model";
import { inventoryStocks } from "../inventory/inventory.schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
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

static async getLockedStocks(warehouseId: string, itemIds: string[]): Promise<Set<string>> {
    if (!itemIds.length) return new Set();

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
          inArray(purchaseRequestDetails.itemId, itemIds),
          isNull(purchaseRequests.deletedAt),
          isNull(purchaseRequestDetails.deletedAt)
        )
      );

    return new Set(lockedPRs.map(pr => String(pr.itemId)));
  }

  static async completeTransaction(transactionId: string, userId?: string, isSuperadmin = false) {
    const txData = await TransactionModel.findById(transactionId);
    if (!txData) throw new Error("Transaction not found");
    if (txData.status !== "DRAFT") throw new Error("Only DRAFT transactions can be completed");

    const aggregatedItems = new Map<string, number>();
    for (const item of txData.items) {
      aggregatedItems.set(item.itemId, (aggregatedItems.get(item.itemId) || 0) + Number(item.quantity));
    }
    const uniqueItemIds = Array.from(aggregatedItems.keys());

    // Stock Locking: non-superadmin cannot modify OUT transactions on locked stocks
    if (txData.type === "OUT" && !isSuperadmin) {
      const lockedStocks = await TransactionService.getLockedStocks(txData.warehouseId, uniqueItemIds);
      for (const itemId of uniqueItemIds) {
        if (lockedStocks.has(itemId)) {
          throw new Error(`Stok untuk item ${itemId} sedang dikunci oleh Purchase Request yang telah disetujui. Hanya Superadmin yang dapat mengubah stok ini.`);
        }
      }
    }

    await db.transaction(async (tx) => {
      const stocks = uniqueItemIds.length > 0
        ? await tx
            .select()
            .from(inventoryStocks)
            .where(
              and(
                eq(inventoryStocks.warehouseId, txData.warehouseId),
                inArray(inventoryStocks.itemId, uniqueItemIds)
              )
            )
        : [];
      const stockMap = new Map(stocks.map((s) => [s.itemId, s]));

      const insertPayloads = [];
      const existingStockIds: string[] = [];
      const physicalQtyCases: any[] = [];
      const availableQtyCases: any[] = [];

      for (const [itemId, qty] of aggregatedItems.entries()) {
        const stock = stockMap.get(itemId);

        if (txData.type === "IN") {
          if (stock) {
            existingStockIds.push(stock.id);
            physicalQtyCases.push(sql`WHEN ${inventoryStocks.id} = ${stock.id} THEN (${inventoryStocks.physicalQty}::numeric + ${qty})::text`);
            availableQtyCases.push(sql`WHEN ${inventoryStocks.id} = ${stock.id} THEN (${inventoryStocks.availableQty}::numeric + ${qty})::text`);
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
          existingStockIds.push(stock.id);
          physicalQtyCases.push(sql`WHEN ${inventoryStocks.id} = ${stock.id} THEN (${inventoryStocks.physicalQty}::numeric - ${qty})::text`);
          availableQtyCases.push(sql`WHEN ${inventoryStocks.id} = ${stock.id} THEN (${inventoryStocks.availableQty}::numeric - ${qty})::text`);
        }
      }

      if (existingStockIds.length > 0) {
        await tx
          .update(inventoryStocks)
          .set({
            physicalQty: sql.join([sql`CASE`, ...physicalQtyCases, sql`END`], sql` `),
            availableQty: sql.join([sql`CASE`, ...availableQtyCases, sql`END`], sql` `),
            updatedAt: new Date(),
            updatedBy: userId
          })
          .where(inArray(inventoryStocks.id, existingStockIds));
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

      const aggregatedItems = new Map<string, number>();
      for (const item of txData.items) {
        aggregatedItems.set(item.itemId, (aggregatedItems.get(item.itemId) || 0) + Number(item.quantity));
      }
      const uniqueItemIds = Array.from(aggregatedItems.keys());

      await db.transaction(async (tx) => {
        const stocks = uniqueItemIds.length > 0
          ? await tx
              .select()
              .from(inventoryStocks)
              .where(
                and(
                  eq(inventoryStocks.warehouseId, txData.warehouseId),
                  inArray(inventoryStocks.itemId, uniqueItemIds)
                )
              )
          : [];
        const stockMap = new Map(stocks.map((s) => [s.itemId, s]));

        const existingStockIds: string[] = [];
        const physicalQtyCases: any[] = [];
        const availableQtyCases: any[] = [];

        for (const [itemId, qty] of aggregatedItems.entries()) {
          const stock = stockMap.get(itemId);

          if (stock) {
            existingStockIds.push(stock.id);
            if (txData.type === "IN") {
              // Revert IN -> subtract
              physicalQtyCases.push(sql`WHEN ${inventoryStocks.id} = ${stock.id} THEN (${inventoryStocks.physicalQty}::numeric - ${qty})::text`);
              availableQtyCases.push(sql`WHEN ${inventoryStocks.id} = ${stock.id} THEN (${inventoryStocks.availableQty}::numeric - ${qty})::text`);
            } else {
              // Revert OUT -> add
              physicalQtyCases.push(sql`WHEN ${inventoryStocks.id} = ${stock.id} THEN (${inventoryStocks.physicalQty}::numeric + ${qty})::text`);
              availableQtyCases.push(sql`WHEN ${inventoryStocks.id} = ${stock.id} THEN (${inventoryStocks.availableQty}::numeric + ${qty})::text`);
            }
          }
        }

        if (existingStockIds.length > 0) {
          await tx
            .update(inventoryStocks)
            .set({
              physicalQty: sql.join([sql`CASE`, ...physicalQtyCases, sql`END`], sql` `),
              availableQty: sql.join([sql`CASE`, ...availableQtyCases, sql`END`], sql` `),
              updatedAt: new Date(),
              updatedBy: approvedBy
            })
            .where(inArray(inventoryStocks.id, existingStockIds));
        }
      });
    }
  }
}

