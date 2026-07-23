import type { Context } from "elysia";
import { failedResponse, successResponse } from "../../core/utils/response";
import { db } from "../../core/db";
import { transactions, transactionItems } from "../transaction/transaction.schema";
import { inventoryStocks } from "../inventory/inventory.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { eq, and, sql, desc } from "drizzle-orm";

export class DashboardController {
  static async getKpi(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      // ⚡ Bolt: Optimize by grouping 4 independent database queries into Promise.all to run them concurrently
      const [
        [inbound],
        [outbound],
        [activeWarehouses],
        [lowStock]
      ] = await Promise.all([
        // 1. Total Barang Masuk (sum of quantities from IN transactions that are COMPLETED)
        db
          .select({ total: sql<number>`COALESCE(sum(${transactionItems.quantity}), 0)` })
          .from(transactionItems)
          .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
          .where(and(eq(transactions.type, "IN"), eq(transactions.status, "COMPLETED"))),

        // 2. Total Barang Keluar (sum of quantities from OUT transactions that are COMPLETED)
        db
          .select({ total: sql<number>`COALESCE(sum(${transactionItems.quantity}), 0)` })
          .from(transactionItems)
          .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
          .where(and(eq(transactions.type, "OUT"), eq(transactions.status, "COMPLETED"))),

        // 3. Gudang Aktif
        db
          .select({ count: sql<number>`cast(count(${warehouses.id}) as int)` })
          .from(warehouses)
          .where(eq(warehouses.isActive, true)),

        // 4. Low Stock Items (quantity < 10)
        db
          .select({ count: sql<number>`cast(count(${inventoryStocks.id}) as int)` })
          .from(inventoryStocks)
          .where(sql`${inventoryStocks.availableQty} < 100`),
      ]);

      const kpiData = {
        totalBarangMasuk: inbound?.total ?? 0,
        totalBarangKeluar: outbound?.total ?? 0,
        gudangAktif: activeWarehouses?.count ?? 0,
        lowStockItems: lowStock?.count ?? 0,
      };

      return successResponse(correlationId, "KPI data retrieved", { record: kpiData });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to retrieve KPI", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async getActivities(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      // Get 5 recent completed transactions
      const recentTx = await db
        .select({
          id: transactions.id,
          referenceNumber: transactions.referenceNumber,
          type: transactions.type,
          description: transactions.description,
          transactionDate: transactions.transactionDate,
          warehouseName: warehouses.name,
          totalQuantity: sql<number>`COALESCE((SELECT sum(quantity) FROM ${transactionItems} WHERE transaction_id = ${transactions.id}), 0)`
        })
        .from(transactions)
        .innerJoin(warehouses, eq(transactions.warehouseId, warehouses.id))
        .where(eq(transactions.status, "COMPLETED"))
        .orderBy(desc(transactions.transactionDate))
        .limit(5);

      return successResponse(correlationId, "Activities retrieved", { records: recentTx });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to retrieve activities", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
