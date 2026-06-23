import { db } from "./src/core/db";
import { transactions, transactionItems } from "./src/modules/transaction/transaction.schema";
import { inventoryStocks } from "./src/modules/inventory/inventory.schema";
import { warehouses } from "./src/modules/warehouse/warehouse.schema";
import { eq, and, sql, desc, sum } from "drizzle-orm";

async function main() {
      // 1. Total Barang Masuk (sum of quantities from IN transactions that are COMPLETED)
      const [inbound] = await db
        .select({ total: sql<number>`COALESCE(sum(${transactionItems.quantity}), 0)` })
        .from(transactionItems)
        .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
        .where(and(eq(transactions.type, "IN"), eq(transactions.status, "COMPLETED")));

      // 2. Total Barang Keluar (sum of quantities from OUT transactions that are COMPLETED)
      const [outbound] = await db
        .select({ total: sql<number>`COALESCE(sum(${transactionItems.quantity}), 0)` })
        .from(transactionItems)
        .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
        .where(and(eq(transactions.type, "OUT"), eq(transactions.status, "COMPLETED")));

      // 3. Gudang Aktif
      const [activeWarehouses] = await db
        .select({ count: sql<number>`cast(count(${warehouses.id}) as int)` })
        .from(warehouses)
        .where(and(eq(warehouses.isActive, true), eq(warehouses.deletedAt, null)));

      // 4. Low Stock Items (quantity < 10)
      const [lowStock] = await db
        .select({ count: sql<number>`cast(count(${inventoryStocks.id}) as int)` })
        .from(inventoryStocks)
        .where(sql`${inventoryStocks.quantity} < 10`);

      const kpiData = {
        totalBarangMasuk: Number(inbound?.total ?? 0),
        totalBarangKeluar: Number(outbound?.total ?? 0),
        gudangAktif: Number(activeWarehouses?.count ?? 0),
        lowStockItems: Number(lowStock?.count ?? 0),
      };

      console.log(JSON.stringify(kpiData, null, 2));
      process.exit(0);
}
main();
