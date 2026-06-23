import { db } from "../../core/db";
import { transactions, transactionItems, transactionApprovals, type TransactionInsert, type TransactionItemInsert, type TransactionApprovalInsert } from "./transaction.schema";
import { inventoryStocks } from "../inventory/inventory.schema";
import { eq, and, sql, desc, or, ilike } from "drizzle-orm";
import { warehouses } from "../warehouse/warehouse.schema";
import { users } from "../user/user.schema";

interface FindAllOptions {
  page: number;
  limit: number;
  warehouseId?: string;
  type?: "IN" | "OUT";
  status?: "DRAFT" | "COMPLETED" | "CANCEL_PENDING" | "CANCELLED";
  searchTerm?: string;
}

export class TransactionModel {
  static async findAll(opts: FindAllOptions) {
    const offset = (opts.page - 1) * opts.limit;
    const conditions = [eq(transactions.deletedAt, null)];

    if (opts.warehouseId) {
      conditions.push(eq(transactions.warehouseId, opts.warehouseId));
    }
    if (opts.type) {
      conditions.push(eq(transactions.type, opts.type));
    }
    if (opts.status) {
      conditions.push(eq(transactions.status, opts.status));
    }
    if (opts.searchTerm) {
      conditions.push(
        or(
          ilike(transactions.referenceNumber, `%${opts.searchTerm}%`),
          ilike(transactions.description, `%${opts.searchTerm}%`)
        )
      );
    }

    const whereClause = and(...conditions);

    const query = db
      .select({
        id: transactions.id,
        referenceNumber: transactions.referenceNumber,
        warehouseId: transactions.warehouseId,
        warehouseName: warehouses.name,
        type: transactions.type,
        status: transactions.status,
        description: transactions.description,
        transactionDate: transactions.transactionDate,
        createdAt: transactions.createdAt,
        createdBy: users.name,
      })
      .from(transactions)
      .innerJoin(warehouses, eq(transactions.warehouseId, warehouses.id))
      .innerJoin(users, eq(transactions.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(transactions.createdAt))
      .limit(opts.limit)
      .offset(offset);

    return await query;
  }

  static async countAll(opts: Omit<FindAllOptions, "page" | "limit">) {
    const conditions = [eq(transactions.deletedAt, null)];

    if (opts.warehouseId) {
      conditions.push(eq(transactions.warehouseId, opts.warehouseId));
    }
    if (opts.type) {
      conditions.push(eq(transactions.type, opts.type));
    }
    if (opts.status) {
      conditions.push(eq(transactions.status, opts.status));
    }
    if (opts.searchTerm) {
      conditions.push(
        or(
          ilike(transactions.referenceNumber, `%${opts.searchTerm}%`),
          ilike(transactions.description, `%${opts.searchTerm}%`)
        )
      );
    }

    const whereClause = and(...conditions);

    const [record] = await db
      .select({ count: sql<number>`cast(count(${transactions.id}) as int)` })
      .from(transactions)
      .where(whereClause);

    return record?.count ?? 0;
  }

  static async findById(id: string) {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.deletedAt, null)))
      .limit(1);
    
    if (!tx) return null;

    const items = await db
      .select()
      .from(transactionItems)
      .where(and(eq(transactionItems.transactionId, id), eq(transactionItems.deletedAt, null)));

    return { ...tx, items };
  }

  static async create(txData: TransactionInsert, itemsData: Omit<TransactionItemInsert, "transactionId">[]) {
    return await db.transaction(async (tx) => {
      const [insertedTx] = await tx.insert(transactions).values(txData).returning();
      
      if (itemsData.length > 0) {
        const itemsToInsert = itemsData.map(item => ({
          ...item,
          transactionId: insertedTx.id
        }));
        await tx.insert(transactionItems).values(itemsToInsert);
      }

      return insertedTx;
    });
  }

  static async updateStatus(id: string, status: TransactionInsert["status"]) {
    const [updated] = await db
      .update(transactions)
      .set({ status, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return updated;
  }

  static async requestCancel(data: TransactionApprovalInsert) {
    return await db.transaction(async (tx) => {
      const [approval] = await tx.insert(transactionApprovals).values(data).returning();
      await tx.update(transactions).set({ status: "CANCEL_PENDING", updatedAt: new Date() }).where(eq(transactions.id, data.transactionId));
      return approval;
    });
  }

  static async processCancelApproval(approvalId: string, status: "APPROVED" | "REJECTED", approvedBy: string, responseRemark?: string) {
    return await db.transaction(async (tx) => {
      const [approval] = await tx
        .update(transactionApprovals)
        .set({ status, approvedBy, responseRemark, updatedAt: new Date() })
        .where(eq(transactionApprovals.id, approvalId))
        .returning();

      if (status === "APPROVED") {
        await tx.update(transactions).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(transactions.id, approval.transactionId));
      } else {
        // If rejected, usually revert status back to COMPLETED or DRAFT based on previous state. 
        // For simplicity, we assume it reverts to COMPLETED since it was requested from COMPLETED.
        await tx.update(transactions).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(transactions.id, approval.transactionId));
      }

      return approval;
    });
  }

  static async getPendingApprovalByTransaction(transactionId: string) {
    const [approval] = await db
      .select()
      .from(transactionApprovals)
      .where(and(eq(transactionApprovals.transactionId, transactionId), eq(transactionApprovals.status, "PENDING")))
      .limit(1);
    return approval;
  }
}
