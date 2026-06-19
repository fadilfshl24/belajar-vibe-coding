import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { items, itemPackageDetails } from "./item.schema";
import { toItemDTO, type ItemDTO } from "./item.dto";
import type { ItemRecord, ItemPackageDetailRecord } from "./item.schema";
import type { CreateItemInput, UpdateItemInput } from "./item.validation";

// ---------------------------------------------------------------------------
// Kalkulasi diskon otomatis
// ---------------------------------------------------------------------------

function calcDiscount(price: number, discountPercentage: number) {
  const discountPrice = Number((price * (discountPercentage / 100)).toFixed(2));
  const priceAfterDiscount = Number((price - discountPrice).toFixed(2));
  return { discountPrice, priceAfterDiscount };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: items.id,
    Code: items.code,
    Name: items.name,
    ItemType: items.itemType,
    SellingPrice: items.sellingPrice,
    IsActive: items.isActive,
    CreatedAt: items.createdAt,
    UpdatedAt: items.updatedAt,
  };
  return (map[key] ?? items.createdAt) as AnyColumn;
}

function parseOrderBy(orderBy: string): { column: AnyColumn; direction: "asc" | "desc" } {
  try {
    const normalized = orderBy.replace(/'/g, '"');
    const parsed = JSON.parse(normalized) as Record<string, string>;
    const [key, dir] = Object.entries(parsed)[0] ?? ["CreatedAt", "DESC"];
    return {
      column: resolveOrderColumn(key),
      direction: (dir?.toUpperCase() === "ASC" ? "asc" : "desc") as "asc" | "desc",
    };
  } catch {
    return { column: items.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(searchTerm?: string, filterColumn?: string, itemType?: "single" | "package") {
  let conds = isNull(items.deletedAt);
  if (itemType) {
    conds = and(conds, eq(items.itemType, itemType))!;
  }
  if (searchTerm && filterColumn) {
    const term = searchTerm.trim();
    if (term !== "") {
      if (filterColumn === "name") {
        conds = and(conds, ilike(items.name, `%${term}%`))!;
      } else if (filterColumn === "code") {
        conds = and(conds, ilike(items.code, `%${term}%`))!;
      }
    }
  }
  return conds;
}

export class ItemModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    itemType?: "single" | "package";
  }): Promise<ItemDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, itemType } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition(searchTerm, filterColumn, itemType);
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(items)
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(item => toItemDTO(item));
  }

  static async countAll(searchTerm?: string, filterColumn?: string, itemType?: "single" | "package"): Promise<number> {
    const whereClause = buildFilterCondition(searchTerm, filterColumn, itemType);
    const result = await db.select({ total: count() }).from(items).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<ItemDTO | undefined> {
    const result = await db
      .select()
      .from(items)
      .where(and(eq(items.id, id), isNull(items.deletedAt)))
      .limit(1);
    if (result.length === 0) return undefined;
    const item = result[0];
    if (item?.itemType === "package") {
      const details = await db
        .select()
        .from(itemPackageDetails)
        .where(and(eq(itemPackageDetails.packageItemId, id), isNull(itemPackageDetails.deletedAt)));
      return toItemDTO(item, details);
    }

    return item ? toItemDTO(item) : undefined;
  }

  static async findByCode(code: string): Promise<ItemRecord | undefined> {
    const result = await db
      .select()
      .from(items)
      .where(and(eq(items.code, code), isNull(items.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async create(payload: CreateItemInput): Promise<ItemDTO> {
    return await db.transaction(async (tx) => {
      const { discountPrice, priceAfterDiscount } = calcDiscount(payload.sellingPrice, payload.discountPercentage ?? 0);
      const [insertedItem] = await tx
        .insert(items)
        .values({
          code: payload.code,
          name: payload.name,
          description: payload.description || null,
          uomId: payload.uomId,
          categoryId: payload.categoryId,
          barcodeText: payload.barcodeText || null,
          barcodeType: payload.barcodeType || null,
          imageUrl: payload.imageUrl || null,
          itemType: payload.itemType,
          purchasePrice: String(payload.purchasePrice || 0),
          sellingPrice: String(payload.sellingPrice || 0),
          discountPercentage: String(payload.discountPercentage ?? 0),
          discountPrice: String(discountPrice),
          priceAfterDiscount: String(priceAfterDiscount),
          isActive: payload.isActive ?? true,
        })
        .returning();

      if (!insertedItem) throw new Error("Failed to create item");

      const detailRecords: ItemPackageDetailRecord[] = [];

      if (payload.itemType === "package" && payload.details) {
        for (const detail of payload.details) {
          const child = await tx
            .select()
            .from(items)
            .where(and(eq(items.id, detail.childItemId), isNull(items.deletedAt)))
            .limit(1);
          const childItem = child[0];
          if (!childItem) {
            throw new Error(`Child item ID ${detail.childItemId} not found`);
          }
          if (childItem.itemType !== "single") {
            throw new Error(`Child item ID ${detail.childItemId} must be type 'single'`);
          }
          const { discountPrice: dDiscPrice, priceAfterDiscount: dPriceAfter } = calcDiscount(detail.price, detail.discountPercentage ?? 0);
          const [insertedDetail] = await tx
            .insert(itemPackageDetails)
            .values({
              packageItemId: insertedItem.id,
              childItemId: detail.childItemId,
              quantity: String(detail.quantity),
              price: String(detail.price),
              discountPercentage: String(detail.discountPercentage ?? 0),
              discountPrice: String(dDiscPrice),
              priceAfterDiscount: String(dPriceAfter),
              isActive: true,
            })
            .returning();
          if (insertedDetail) detailRecords.push(insertedDetail);
        }
      }

      return toItemDTO(insertedItem, detailRecords.length > 0 ? detailRecords : undefined);
    });
  }

  static async update(id: string, payload: UpdateItemInput): Promise<ItemDTO | undefined> {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(items)
        .where(and(eq(items.id, id), isNull(items.deletedAt)))
        .limit(1);
      if (existing.length === 0) return undefined;
      const current = existing[0];

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (payload.code !== undefined) updateData.code = payload.code;
      if (payload.name !== undefined) updateData.name = payload.name;
      if (payload.description !== undefined) updateData.description = payload.description;
      if (payload.uomId !== undefined) updateData.uomId = payload.uomId;
      if (payload.categoryId !== undefined) updateData.categoryId = payload.categoryId;
      if (payload.barcodeText !== undefined) updateData.barcodeText = payload.barcodeText;
      if (payload.barcodeType !== undefined) updateData.barcodeType = payload.barcodeType;
      if (payload.imageUrl !== undefined) updateData.imageUrl = payload.imageUrl;
      if (payload.itemType !== undefined) updateData.itemType = payload.itemType;
      if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

      const sellingPrice = payload.sellingPrice !== undefined ? payload.sellingPrice : Number(current?.sellingPrice);
      const discountPercentage = payload.discountPercentage !== undefined ? payload.discountPercentage : Number(current?.discountPercentage);

      if (payload.purchasePrice !== undefined) updateData.purchasePrice = String(payload.purchasePrice);
      if (payload.sellingPrice !== undefined) updateData.sellingPrice = String(payload.sellingPrice);
      if (payload.discountPercentage !== undefined) updateData.discountPercentage = String(payload.discountPercentage);

      const { discountPrice, priceAfterDiscount } = calcDiscount(sellingPrice, discountPercentage);
      updateData.discountPrice = String(discountPrice);
      updateData.priceAfterDiscount = String(priceAfterDiscount);

      const [updatedItem] = await tx
        .update(items)
        .set(updateData)
        .where(eq(items.id, id))
        .returning();

      if (!updatedItem) return undefined;

      const itemType = payload.itemType !== undefined ? payload.itemType : current?.itemType;

      if (itemType === "package" && payload.details !== undefined) {
        await tx.delete(itemPackageDetails).where(eq(itemPackageDetails.packageItemId, id));

        const detailRecords: ItemPackageDetailRecord[] = [];
        for (const detail of payload.details) {
          const child = await tx
            .select()
            .from(items)
            .where(and(eq(items.id, detail.childItemId), isNull(items.deletedAt)))
            .limit(1);
          const childItem = child[0];
          if (!childItem) {
            throw new Error(`Child item ID ${detail.childItemId} not found`);
          }
          if (childItem.itemType !== "single") {
            throw new Error(`Child item ID ${detail.childItemId} must be type 'single'`);
          }
          const { discountPrice: dDiscPrice, priceAfterDiscount: dPriceAfter } = calcDiscount(detail.price, detail.discountPercentage ?? 0);
          const [insertedDetail] = await tx
            .insert(itemPackageDetails)
            .values({
              packageItemId: updatedItem.id,
              childItemId: detail.childItemId,
              quantity: String(detail.quantity),
              price: String(detail.price),
              discountPercentage: String(detail.discountPercentage ?? 0),
              discountPrice: String(dDiscPrice),
              priceAfterDiscount: String(dPriceAfter),
              isActive: true,
            })
            .returning();
          if (insertedDetail) detailRecords.push(insertedDetail);
        }
        return toItemDTO(updatedItem, detailRecords);
      } else if (itemType === "package") {
        const details = await tx
          .select()
          .from(itemPackageDetails)
          .where(and(eq(itemPackageDetails.packageItemId, id), isNull(itemPackageDetails.deletedAt)));
        return toItemDTO(updatedItem, details);
      }

      return toItemDTO(updatedItem);
    });
  }

  static async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(items)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(items.id, id), isNull(items.deletedAt)))
      .returning({ id: items.id });
    return result.length > 0;
  }
}