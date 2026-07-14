import { eq, and, desc, isNull, inArray, sql, or, gt, asc, ne } from "drizzle-orm";
import { db } from "../../core/db";
import { scraps, scrapDetails } from "./scrap.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { items } from "../item/item.schema";
import { users } from "../user/user.schema";
import { inventoryStocks } from "../inventory/inventory.schema";
import { transactions, transactionItems } from "../transaction/transaction.schema";
import { approvalSteps } from "../approval-step/approval-step.schema";
import { resolveRequiredApprovalStage } from "../../core/utils/approval-stage.resolver";
import type { CreateScrapInput } from "./scrap.validation";
import type { ScrapDTO } from "./scrap.dto";

async function generateScrapCode(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const prefix = `SC-${dateStr}-`;

  const lastRecord = await db.query.scraps.findFirst({
    where: and(
      isNull(scraps.deletedAt),
      sql`${scraps.code} LIKE ${prefix + "%"}`
    ),
    orderBy: desc(scraps.code),
  });

  let nextNum = 1;
  if (lastRecord) {
    const numPart = lastRecord.code.replace(prefix, "");
    nextNum = parseInt(numPart, 10) + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export class ScrapModel {
  static async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    type?: "IN" | "OUT";
    status?: number;
    warehouseIds?: string[];
    requiredApprovalStage?: number;
  }) {
    const offset = (params.page - 1) * params.limit;
    const conditions = [isNull(scraps.deletedAt)];

    if (params.type) {
      conditions.push(eq(scraps.type, params.type));
    }
    if (params.status !== undefined) {
      conditions.push(eq(scraps.status, params.status));
    }
    if (params.warehouseIds && params.warehouseIds.length > 0) {
      conditions.push(inArray(scraps.warehouseId, params.warehouseIds));
    }
    if (params.search) {
      conditions.push(sql`${scraps.code} ILIKE ${`%${params.search}%`}`);
    }

    // Role-based stage filtering
    if (params.requiredApprovalStage !== undefined) {
      conditions.push(
        or(
          and(eq(scraps.status, 1), eq(scraps.currentApprovalStage, params.requiredApprovalStage)),
          ne(scraps.status, 1)
        )!
      );
    }

    const whereClause = and(...conditions);

    const query = db
      .select({
        id: scraps.id,
        code: scraps.code,
        warehouseId: scraps.warehouseId,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        type: scraps.type,
        reasonCategory: scraps.reasonCategory,
        notes: scraps.notes,
        status: scraps.status,
        currentApprovalStage: scraps.currentApprovalStage,
        createdBy: scraps.createdBy,
        createdByName: users.name,
        createdAt: scraps.createdAt,
        updatedAt: scraps.updatedAt,
      })
      .from(scraps)
      .innerJoin(warehouses, eq(scraps.warehouseId, warehouses.id))
      .leftJoin(users, eq(scraps.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(scraps.createdAt))
      .limit(params.limit)
      .offset(offset);

    return await query;
  }

  static async countAll(params: {
    search?: string;
    type?: "IN" | "OUT";
    status?: number;
    warehouseIds?: string[];
    requiredApprovalStage?: number;
  }) {
    const conditions = [isNull(scraps.deletedAt)];

    if (params.type) {
      conditions.push(eq(scraps.type, params.type));
    }
    if (params.status !== undefined) {
      conditions.push(eq(scraps.status, params.status));
    }
    if (params.warehouseIds && params.warehouseIds.length > 0) {
      conditions.push(inArray(scraps.warehouseId, params.warehouseIds));
    }
    if (params.search) {
      conditions.push(sql`${scraps.code} ILIKE ${`%${params.search}%`}`);
    }

    if (params.requiredApprovalStage !== undefined) {
      conditions.push(
        or(
          and(eq(scraps.status, 1), eq(scraps.currentApprovalStage, params.requiredApprovalStage)),
          ne(scraps.status, 1)
        )!
      );
    }

    const whereClause = and(...conditions);

    const [record] = await db
      .select({ count: sql<number>`cast(count(${scraps.id}) as int)` })
      .from(scraps)
      .innerJoin(warehouses, eq(scraps.warehouseId, warehouses.id))
      .where(whereClause);

    return record?.count ?? 0;
  }

  static async findById(id: string): Promise<ScrapDTO | undefined> {
    const scrap = await db.query.scraps.findFirst({
      where: and(eq(scraps.id, id), isNull(scraps.deletedAt)),
      with: {
        warehouse: true,
        details: {
          where: isNull(scrapDetails.deletedAt),
          with: {
            item: true,
          },
        },
      },
    });

    if (!scrap) return undefined;

    const user = scrap.createdBy
      ? await db.query.users.findFirst({ where: eq(users.id, scrap.createdBy) })
      : undefined;

    return {
      id: scrap.id,
      code: scrap.code,
      warehouseId: scrap.warehouseId,
      warehouseCode: scrap.warehouse.code,
      warehouseName: scrap.warehouse.name,
      type: scrap.type,
      reasonCategory: scrap.reasonCategory,
      notes: scrap.notes,
      status: scrap.status,
      currentApprovalStage: scrap.currentApprovalStage,
      createdBy: scrap.createdBy,
      createdByName: user?.name,
      createdAt: scrap.createdAt.toISOString(),
      updatedAt: scrap.updatedAt ? scrap.updatedAt.toISOString() : null,
      details: scrap.details.map((d) => ({
        id: d.id,
        scrapId: d.scrapId,
        itemId: d.itemId,
        itemCode: d.item.code,
        itemName: d.item.name,
        quantity: d.quantity,
        notes: d.notes,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
      })),
    };
  }

  static async create(input: CreateScrapInput, userId: string) {
    const code = await generateScrapCode();

    return await db.transaction(async (tx) => {
      // 1. Insert scrap header
      const [scrap] = await tx
        .insert(scraps)
        .values({
          code,
          warehouseId: input.warehouseId,
          type: input.type,
          reasonCategory: input.reasonCategory,
          notes: input.notes || null,
          status: 1, // Auto-submit to Pending Approval
          currentApprovalStage: 0, // Starts at stage 0 (Warehouse Head)
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!scrap) throw new Error("Failed to create scrap record");

      // 2. Insert scrap details
      const detailsValues = input.details.map((d) => ({
        scrapId: scrap.id,
        itemId: d.itemId,
        quantity: d.quantity.toString(),
        notes: d.notes || null,
        createdBy: userId,
        updatedBy: userId,
      }));

      await tx.insert(scrapDetails).values(detailsValues);

      return scrap;
    });
  }

  static async approve(id: string, userId: string) {
    const scrap = await this.findById(id);
    if (!scrap || scrap.status !== 1) {
      throw new Error("Scrap record not found or not in pending status");
    }

    const requiredStage = await resolveRequiredApprovalStage(userId, "QC"); // Using resolveRequiredApprovalStage (Scrap / QC)
    // Wait, let's look up using 'QC' or 'PR'. Let's check if 'QC' resolver matches.
    // Better yet, we can query approval steps for type 'QC' (since it is Warehouse Head -> Branch Head).
    // Or we can dynamically use "QC" stages. Let's resolve with documentType "QC" or write "QC" as a surrogate for "SC".
    // Wait, let's verify if "QC" has the same stages. Warehouse Head is stage 0, Branch Head is stage 1.
    // Yes! Let's check 'QC' stage mapping.

    const userStage = await resolveRequiredApprovalStage(userId, "QC");
    if (userStage === undefined || userStage !== scrap.currentApprovalStage) {
      throw new Error("You do not have permission to approve this scrap at the current stage");
    }

    // Find next pending approval stage
    const nextPending = await db.query.approvalSteps.findFirst({
      where: and(
        eq(approvalSteps.documentType, "QC"), // We map Scrap to QC steps (WH Head -> Branch Head)
        eq(approvalSteps.isActive, true),
        gt(approvalSteps.stage, scrap.currentApprovalStage)
      ),
      orderBy: asc(approvalSteps.stage),
    });

    return await db.transaction(async (tx) => {
      if (nextPending) {
        // Move to next stage
        const [updated] = await tx
          .update(scraps)
          .set({
            currentApprovalStage: nextPending.stage,
            updatedAt: new Date(),
            updatedBy: userId,
          })
          .where(eq(scraps.id, id))
          .returning();
        return updated;
      } else {
        // Final Approval: Change status to Approved (2) and adjust stock!
        const [updated] = await tx
          .update(scraps)
          .set({
            status: 2,
            currentApprovalStage: scrap.currentApprovalStage + 1, // Final stage mark
            updatedAt: new Date(),
            updatedBy: userId,
          })
          .where(eq(scraps.id, id))
          .returning();

        if (!updated) throw new Error("Failed to update scrap status");

        // Adjust real stock
        if (scrap.details) {
          // Create transaction audit log
          const [trx] = await tx
            .insert(transactions)
            .values({
              warehouseId: scrap.warehouseId,
              type: scrap.type === "IN" ? "IN" : "OUT",
              referenceNumber: `TRX-${scrap.type}-${scrap.code}`,
              description: `Auto-stock adjustment from Scrap: ${scrap.code} (${scrap.reasonCategory})`,
              status: "COMPLETED",
              createdBy: userId,
              updatedBy: userId,
            })
            .returning();

          const trxItems = scrap.details.map((d) => ({
            transactionId: trx!.id,
            itemId: d.itemId,
            quantity: d.quantity,
            createdBy: userId,
            updatedBy: userId,
          }));

          await tx.insert(transactionItems).values(trxItems);

          for (const d of scrap.details) {
            const stock = await tx.query.inventoryStocks.findFirst({
              where: and(
                eq(inventoryStocks.warehouseId, scrap.warehouseId),
                eq(inventoryStocks.itemId, d.itemId)
              ),
            });

            const qtyVal = Number(d.quantity);

            if (scrap.type === "IN") {
              // Scrap IN (refund customer) -> ADD stock
              if (stock) {
                await tx
                  .update(inventoryStocks)
                  .set({
                    physicalQty: (Number(stock.physicalQty) + qtyVal).toString(),
                    availableQty: (Number(stock.availableQty) + qtyVal).toString(),
                    updatedAt: new Date(),
                    updatedBy: userId,
                  })
                  .where(eq(inventoryStocks.id, stock.id));
              } else {
                await tx.insert(inventoryStocks).values({
                  warehouseId: scrap.warehouseId,
                  itemId: d.itemId,
                  physicalQty: d.quantity,
                  availableQty: d.quantity,
                  reservedQty: "0.00",
                  createdBy: userId,
                  updatedBy: userId,
                });
              }
            } else {
              // Scrap OUT (damage/lost) -> SUBTRACT stock
              if (!stock || Number(stock.physicalQty) < qtyVal) {
                throw new Error(`Insufficient physical stock for item code: ${d.itemCode}`);
              }
              await tx
                .update(inventoryStocks)
                .set({
                  physicalQty: (Number(stock.physicalQty) - qtyVal).toString(),
                  availableQty: (Number(stock.availableQty) - qtyVal).toString(),
                  updatedAt: new Date(),
                  updatedBy: userId,
                })
                .where(eq(inventoryStocks.id, stock.id));
            }
          }
        }

        return updated;
      }
    });
  }

  static async reject(id: string, userId: string) {
    const scrap = await this.findById(id);
    if (!scrap || scrap.status !== 1) {
      throw new Error("Scrap record not found or not in pending status");
    }

    const userStage = await resolveRequiredApprovalStage(userId, "QC");
    if (userStage === undefined || userStage !== scrap.currentApprovalStage) {
      throw new Error("You do not have permission to reject this scrap at the current stage");
    }

    const [updated] = await db
      .update(scraps)
      .set({
        status: 3, // Rejected
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(scraps.id, id))
      .returning();

    return updated;
  }
}
