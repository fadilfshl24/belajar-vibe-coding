import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../core/db";
import { itemPlatformSkus } from "./item-platform-sku.schema";
import type { CreateItemPlatformSkuInput } from "./item-platform-sku.validation";

export class ItemPlatformSkuModel {
  static async findByItemId(itemId: string) {
    return await db.query.itemPlatformSkus.findMany({
      where: and(
        eq(itemPlatformSkus.itemId, itemId),
        isNull(itemPlatformSkus.deletedAt)
      ),
      with: {
        platform: true,
      },
      orderBy: (skus, { desc }) => [desc(skus.createdAt)],
    });
  }

  static async findByPlatformSku(sku: string) {
    const result = await db
      .select()
      .from(itemPlatformSkus)
      .where(
        and(
          eq(itemPlatformSkus.platformSku, sku),
          isNull(itemPlatformSkus.deletedAt)
        )
      )
      .limit(1);
    return result[0];
  }

  static async findById(id: string) {
    const result = await db
      .select()
      .from(itemPlatformSkus)
      .where(
        and(
          eq(itemPlatformSkus.id, id),
          isNull(itemPlatformSkus.deletedAt)
        )
      )
      .limit(1);
    return result[0];
  }

  static async create(itemId: string, data: CreateItemPlatformSkuInput, createdBy?: string) {
    const [result] = await db
      .insert(itemPlatformSkus)
      .values({
        itemId,
        platformId: data.platformId,
        platformSku: data.platformSku,
        createdBy,
      })
      .returning();
    return result;
  }

  static async softDelete(id: string) {
    const [result] = await db
      .update(itemPlatformSkus)
      .set({ deletedAt: new Date() })
      .where(eq(itemPlatformSkus.id, id))
      .returning();
    return result;
  }
}
