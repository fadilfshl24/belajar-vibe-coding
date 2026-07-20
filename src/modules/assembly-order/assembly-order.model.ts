import { eq, and, desc, isNull, inArray, sql, or } from "drizzle-orm";
import { db } from "../../core/db";
import { assemblyOrders, assemblyOrderDetails, assemblyOrderComponents } from "./assembly-order.schema";
import { warehouses } from "../warehouse/warehouse.schema";
import { users } from "../user/user.schema";
import { items } from "../item/item.schema";
import type { IAssemblyOrderQueryFilters } from "./assembly-order.dto";

async function generateAssemblyOrderCode(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const prefix = `AO-${dateStr}-`;

  const lastRecord = await db.query.assemblyOrders.findFirst({
    where: and(
      isNull(assemblyOrders.deletedAt),
      sql`${assemblyOrders.code} LIKE ${prefix + "%"}`
    ),
    orderBy: [desc(assemblyOrders.code)],
  });

  let nextNum = 1;
  if (lastRecord) {
    const numPart = lastRecord.code.replace(prefix, "");
    nextNum = parseInt(numPart, 10) + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export class AssemblyOrderModel {
  static async findAll(params: IAssemblyOrderQueryFilters) {
    const offset = (params.page - 1) * params.limit;
    const conditions = [isNull(assemblyOrders.deletedAt)];

    if (params.status !== undefined) {
      conditions.push(eq(assemblyOrders.status, params.status));
    }
    if (params.warehouseId) {
      conditions.push(eq(assemblyOrders.warehouseId, params.warehouseId));
    } else if (params.warehouseIds && params.warehouseIds.length > 0) {
      conditions.push(inArray(assemblyOrders.warehouseId, params.warehouseIds));
    }

    if (params.searchTerm) {
      conditions.push(sql`${assemblyOrders.code} ILIKE ${`%${params.searchTerm}%`}`);
    }

    const whereClause = and(...conditions);

    const query = db
      .select({
        id: assemblyOrders.id,
        code: assemblyOrders.code,
        warehouseId: assemblyOrders.warehouseId,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        notes: assemblyOrders.notes,
        status: assemblyOrders.status,
        approvedBy: assemblyOrders.approvedBy,
        approvedByName: users.name,
        approvedAt: assemblyOrders.approvedAt,
        createdBy: assemblyOrders.createdBy,
        createdByName: users.name, // Will be mapped properly in leftJoin
        createdAt: assemblyOrders.createdAt,
        updatedAt: assemblyOrders.updatedAt,
      })
      .from(assemblyOrders)
      .innerJoin(warehouses, eq(assemblyOrders.warehouseId, warehouses.id))
      .leftJoin(users, eq(assemblyOrders.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(assemblyOrders.createdAt))
      .limit(params.limit)
      .offset(offset);

    const rows = await query;
    return rows;
  }

  static async countAll(params: Omit<IAssemblyOrderQueryFilters, "page" | "limit" | "orderBy">) {
    const conditions = [isNull(assemblyOrders.deletedAt)];

    if (params.status !== undefined) {
      conditions.push(eq(assemblyOrders.status, params.status));
    }
    if (params.warehouseId) {
      conditions.push(eq(assemblyOrders.warehouseId, params.warehouseId));
    } else if (params.warehouseIds && params.warehouseIds.length > 0) {
      conditions.push(inArray(assemblyOrders.warehouseId, params.warehouseIds));
    }

    if (params.searchTerm) {
      conditions.push(sql`${assemblyOrders.code} ILIKE ${`%${params.searchTerm}%`}`);
    }

    const whereClause = and(...conditions);

    const [record] = await db
      .select({ count: sql<number>`cast(count(${assemblyOrders.id}) as int)` })
      .from(assemblyOrders)
      .innerJoin(warehouses, eq(assemblyOrders.warehouseId, warehouses.id))
      .where(whereClause);

    return record?.count ?? 0;
  }

  static async findById(id: string) {
    const order = await db.query.assemblyOrders.findFirst({
      where: and(eq(assemblyOrders.id, id), isNull(assemblyOrders.deletedAt)),
      with: {
        warehouse: true,
        creator: true,
        approver: true,
        details: {
          where: isNull(assemblyOrderDetails.deletedAt),
          with: {
            item: true,
            components: {
              where: isNull(assemblyOrderComponents.deletedAt),
              with: {
                componentItem: true,
              },
            },
          },
        },
      },
    });

    if (!order) return undefined;

    return {
      id: order.id,
      code: order.code,
      warehouseId: order.warehouseId,
      warehouseCode: order.warehouse.code,
      warehouseName: order.warehouse.name,
      notes: order.notes,
      status: order.status,
      approvedBy: order.approvedBy,
      approvedByName: order.approver?.name || null,
      approvedAt: order.approvedAt ? order.approvedAt.toISOString() : null,
      createdBy: order.createdBy,
      createdByName: order.creator?.name || null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
      details: order.details.map((d) => ({
        id: d.id,
        itemId: d.itemId,
        itemCode: d.item.code,
        itemName: d.item.name,
        quantityProduced: Number(d.quantityProduced),
        unitCost: Number(d.unitCost),
        totalCost: Number(d.totalCost),
        components: d.components.map((c) => ({
          id: c.id,
          componentItemId: c.componentItemId,
          componentItemCode: c.componentItem.code,
          componentItemName: c.componentItem.name,
          quantityUsed: Number(c.quantityUsed),
          quantityReturned: Number(c.quantityReturned),
          pricePerUnit: Number(c.pricePerUnit),
        })),
      })),
    };
  }

  static async create(input: { warehouseId: string; notes?: string; details: Array<{ itemId: string; quantityProduced: number }> }, userId: string) {
    const code = await generateAssemblyOrderCode();

    return await db.transaction(async (tx) => {
      // 1. Insert assembly order header (status 1 = Pending Approval)
      const [order] = await tx
        .insert(assemblyOrders)
        .values({
          code,
          warehouseId: input.warehouseId,
          notes: input.notes || null,
          status: 1, // Pending Approval
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // 2. Process each produced item
      for (const d of input.details) {
        // Fetch item package details (BOM)
        const componentsList = await tx.query.itemPackageDetails.findMany({
          where: and(
            eq(tx.query.itemPackageDetails.schema.itemPackageDetails.packageItemId, d.itemId),
            eq(tx.query.itemPackageDetails.schema.itemPackageDetails.isActive, true),
            isNull(tx.query.itemPackageDetails.schema.itemPackageDetails.deletedAt)
          ),
          with: {
            // Include child item to access purchase price
            childItemId: true, // wait, Drizzle relation name for childItemId might be childItem. Let's check relation name.
          }
        });
        
        // Wait, Drizzle's relations for itemPackageDetails childItemId in item.schema:
        // relation to child item isn't defined explicitly as a named relation but we can query by joining or just query items separately!
        // To be safe and simple, let's query the items table for component details directly.
      }

      return order;
    });
  }
}
