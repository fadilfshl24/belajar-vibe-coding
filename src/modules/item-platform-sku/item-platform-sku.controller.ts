import type { Context } from "elysia";
import { failedResponse, successResponse } from "../../core/utils/response";
import { ItemPlatformSkuModel } from "./item-platform-sku.model";
import { parseCreateItemPlatformSkuInput } from "./item-platform-sku.validation";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { ItemModel } from "../item/item.model";
import { db } from "../../core/db";
import { platforms } from "../platform/platform.schema";
import { eq, and, isNull } from "drizzle-orm";
import { itemPlatformSkus } from "./item-platform-sku.schema";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODULE_TYPE = 'ITEM_PLATFORM_SKU';

export class ItemPlatformSkuController {
  // ---------------------------------------------------------------------------
  // GET /api/items/:itemId/platform-skus
  // ---------------------------------------------------------------------------
  static async getByItemId(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const itemId = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(itemId)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400, "Invalid UUID format");
      }

      const item = await ItemModel.findById(itemId);
      if (!item) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Item not found!", 400);
      }

      const records = await ItemPlatformSkuModel.findByItemId(itemId);
      return successResponse(correlationId, "Data found!", { records });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  // ---------------------------------------------------------------------------
  // POST /api/items/:itemId/platform-skus
  // ---------------------------------------------------------------------------
  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const itemId = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(itemId)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, "Invalid Item ID format");
      }

      const item = await ItemModel.findById(itemId);
      if (!item) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Item not found!", 400);
      }

      const parsed = parseCreateItemPlatformSkuInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, parsed.error.issues[0]?.message ?? "Input invalid!");
      }

      const platformResult = await db.select().from(platforms).where(eq(platforms.id, parsed.data.platformId)).limit(1);
      const platform = platformResult[0];
      if (!platform) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, "Platform not found!");
      }

      // Cek apakah item ini sudah terhubung dengan platform tersebut
      const existingPlatformMapping = await db.select().from(itemPlatformSkus)
        .where(
          and(
            eq(itemPlatformSkus.itemId, itemId),
            eq(itemPlatformSkus.platformId, parsed.data.platformId),
            isNull(itemPlatformSkus.deletedAt)
          )
        )
        .limit(1);
      if (existingPlatformMapping.length > 0) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, "Item ini sudah terhubung dengan platform tersebut");
      }

      const existingSku = await ItemPlatformSkuModel.findByPlatformSku(parsed.data.platformSku);
      if (existingSku) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, "Kode SKU sudah digunakan oleh item lain");
      }

      const record = await ItemPlatformSkuModel.create(itemId, parsed.data, ctx.user?.sub);
      if (!record) {
        ctx.set.status = 500;
        return failedResponse(correlationId, "Create data failed!", 500, "Failed to create SKU mapping record");
      }

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "CREATE_ITEM_SKU_MAPPING",
        description: `User ${ctx.user?.email} menghubungkan item ${item.code} dengan SKU ${record.platformSku} di platform ${platform.name}`,
      });

      return successResponse(correlationId, "Data has been created", { record });
    } catch (err: unknown) {
      ctx.set.status = 400;
      const msg = err instanceof Error ? err.message : "Unknown error";
      const code = msg.includes("not found") || msg.includes("must be") ? 400 : 500;
      ctx.set.status = code;
      return failedResponse(correlationId, code === 400 ? "Create data failed!" : "Internal server error", code as 400 | 500, msg);
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE /api/items/platform-skus/:id
  // ---------------------------------------------------------------------------
  static async remove(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Delete data failed!", 400, "Invalid UUID format");
      }

      const existing = await ItemPlatformSkuModel.findById(id);
      if (!existing) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Data not found!", 400);
      }

      const item = await ItemModel.findById(existing.itemId);
      const platformResult = await db.select().from(platforms).where(eq(platforms.id, existing.platformId)).limit(1);
      const platform = platformResult[0];

      await ItemPlatformSkuModel.softDelete(id);

      await logActivity({
        userId: ctx.user?.sub,
        module: MODULE_TYPE,
        action: "DELETE_ITEM_SKU_MAPPING",
        description: `User ${ctx.user?.email} menghapus hubungan item ${item?.code} dengan SKU ${existing.platformSku} dari platform ${platform?.name}`,
      });

      return successResponse(correlationId, "Data has been deleted", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
