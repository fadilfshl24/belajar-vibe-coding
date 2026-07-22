import type { Context } from "elysia";
import { StockOrderModel } from "./stock-order.model";
import { parseImportStockOrder, parseListStockOrderQuery } from "./stock-order.validation";
import { successResponse, failedResponse } from "../../core/utils/response";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";
import * as xlsx from "xlsx";
import { db } from "../../core/db";
import { itemPlatformSkus } from "../item-platform-sku/item-platform-sku.schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { StockOrderInsert, StockOrderItemInsert } from "./stock-order.schema";
import { platforms } from "../platform";

const MODULE_TYPE = "STOCK_ORDER";

export class StockOrderController {
  static async importExcel(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const userId = ctx.user?.sub;

    if (!userId) {
      ctx.set.status = 401;
      return failedResponse(correlationId, "Unauthorized", 401);
    }

    try {
      const body = ctx.body as { file: File; warehouseId: string; purchaseChannel: string };
      const parsed = parseImportStockOrder(body);
      
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid input data", 400, parsed.error.issues[0]?.message);
      }
      
      if (!body.file || !(body.file instanceof File)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Excel file is required", 400);
      }

      const { warehouseId, purchaseChannel } = parsed.data;

      const arrayBuffer = await body.file.arrayBuffer();
      const workbook = xlsx.read(new Uint8Array(arrayBuffer), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName ?? ""];

      if (!worksheet) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Excel file is empty", 400);
      }
      
      const jsonData: any[] = xlsx.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Excel file is empty", 400);
      }

      // We need to map platforms SKU. Let's fetch all platform skus for this channel? 
      // Actually we should fetch by platform_sku. But wait, `itemPlatformSkus` doesn't have `purchaseChannel`, it has `platformId`.
      // We assume the user has set up the SKUs. We can do queries per row or load all in a map.
      const [platform] = await db.select().from(platforms).where(
        sql`UPPER(${platforms.code}) = ${purchaseChannel.toUpperCase()}`
      ).limit(1);

      if (!platform) {
        ctx.set.status = 400;
        return failedResponse(correlationId, `Platform ${purchaseChannel} tidak ditemukan`, 400);
      }

      const allSkus = await db.select().from(itemPlatformSkus)
      .where(and(eq(itemPlatformSkus.platformId, platform.id), isNull(itemPlatformSkus.deletedAt)))

      const skuMap = new Map(allSkus.map(s => [s.platformSku.toUpperCase(), s.itemId]));

      // For TikTok, we have specific headers
      const stockOrdersMap = new Map<string, { order: StockOrderInsert; items: StockOrderItemInsert[] }>();

      for (const row of jsonData) {
        let orderId = "", trackingId = "", skuId = "", skuName = "", paymentMethod = "", shippingProviderName = "", buyerUsername = "", recipient = "", phone = "", sellerNote = "";
        let quantity = 0;
        
        // TikTok mappings
        if (purchaseChannel === "TikTok") {
          orderId = row["Order ID"]?.toString() || "";
          trackingId = row["Tracking ID"]?.toString() || "";
          skuId = row["SKU ID"]?.toString() || row["Seller SKU"]?.toString() || "";
          skuName = row["Product Name"]?.toString() || "";
          quantity = Number(row["Quantity"]) || 0;
          paymentMethod = row["Payment Method"]?.toString() || null
          shippingProviderName = row["Shipping Provider Name"]?.toString() || null
          buyerUsername = row["Buyer Username"]?.toString() || null
          recipient = row["Recipient"]?.toString() || null;
          phone = row["Phone #"]?.toString() || null
          sellerNote = row["Seller Note"]?.toString() || null
        } else {
          // Fallback or handle SHOPEE, LAZADA, TOKOPEDIA when they have exact templates
          orderId = row["Order ID"]?.toString() || row["order_id"]?.toString() || "";
          trackingId = row["Tracking ID"]?.toString() || row["tracking_id"]?.toString() || row["Resi"]?.toString() || "";
          skuId = row["SKU ID"]?.toString() || row["sku"]?.toString() || "";
          skuName = row["Product Name"]?.toString() || row["product_name"]?.toString() || "";
          quantity = Number(row["Quantity"]) || Number(row["quantity"]) || 0;
        }

        if (!trackingId || !skuId) continue;

        const itemId = skuMap.get(skuId.toUpperCase());
        
        if (!itemId) {
          // In a real app we might reject the file or save a mapping error. For now, we skip or use a fallback? 
          // If strict, we throw error. Let's throw error to notify user that SKU is not mapped.
          ctx.set.status = 400;
          return failedResponse(correlationId, `SKU ${skuId} (${skuName}) belum di-mapping di sistem.`, 400);
        }

        if (!stockOrdersMap.has(trackingId)) {
          stockOrdersMap.set(trackingId, {
            order: {
              purchaseChannel,
              trackingId,
              orderId,
              warehouseId,
              status: "UNPACKED",
              type: "OUTBOUND",
              paymentMethod,
              shippingProviderName,
              buyerUsername,
              recipient,
              phone,
              sellerNote,
              createdBy: userId,
            },
            items: []
          });
        }

        stockOrdersMap.get(trackingId)!.items.push({
          stockOrderId: "", // will be set in model
          itemId,
          skuId,
          skuName,
          skuPrice: row["SKU Unit Original Price"] ? Number(row["SKU Unit Original Price"]).toString() : null,
          quantity: quantity.toString(),
        });
      }

      let importedCount = 0;
      await db.transaction(async (trx) => {
        for (const [trackingId, data] of stockOrdersMap.entries()) {
          // Check if order already exists
          const existing = await StockOrderModel.findByTrackingId(trackingId);
          if (existing) continue; // Skip existing
          
          await StockOrderModel.create(data.order, data.items, trx);
          importedCount++;
        }
      });

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "IMPORT_STOCK_ORDERS",
        description: `Imported ${importedCount} orders for ${purchaseChannel}`,
      });

      return successResponse(correlationId, "Import berhasil", { importedCount });
    } catch (error: any) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, error.message);
    }
  }

  static async list(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    
    try {
      const parsed = parseListStockOrderQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query parameters", 400, parsed.error.issues[0]?.message);
      }

      const { data, count } = await StockOrderModel.findAll(parsed.data);
      const limit = parsed.data.limit || 10;
      const page = parsed.data.page || 1;
      const totalPage = Math.ceil(count / limit);

      return successResponse(correlationId, "Success get data", data, {
        page,
        limit,
        totalRecord: count,
        totalPage,
        nextPage: page < totalPage,
        previousPage: page > 1,
        nextPageURL: "",
        previousPageURL: "",
        filterColumn: "",
        searchTerm: "",
        orderBy: "",
      });
    } catch (error: any) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, error.message);
    }
  }

  static async getByTrackingId(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const { trackingId } = ctx.params as { trackingId: string };

    try {
      const order = await StockOrderModel.findByTrackingId(trackingId);
      if (!order) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Order not found", 404);
      }
      return successResponse(correlationId, "Success get data", order);
    } catch (error: any) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, error.message);
    }
  }

  static async packOrder(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const userId = ctx.user?.sub;
    const { id } = ctx.params as { id: string };

    if (!userId) {
      ctx.set.status = 401;
      return failedResponse(correlationId, "Unauthorized", 401);
    }

    try {
      const updated = await StockOrderModel.packOrder(id, userId);

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "PACKER_ORDER",
        description: `Packer order ${updated?.trackingId}`,
      });

      return successResponse(correlationId, "Order packed successfully", updated);
    } catch (error: any) {
      ctx.set.status = 400;
      return failedResponse(correlationId, error.message, 400);
    }
  }

  static async returnOrder(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const userId = ctx.user?.sub;
    const { id } = ctx.params as { id: string };

    if (!userId) {
      ctx.set.status = 401;
      return failedResponse(correlationId, "Unauthorized", 401);
    }

    try {
      const updated = await StockOrderModel.returnOrder(id, userId);

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "RETURNED_ORDER",
        description: `Returned order ${updated?.trackingId}`,
      });

      return successResponse(correlationId, "Order returned successfully", updated);
    } catch (error: any) {
      ctx.set.status = 400;
      return failedResponse(correlationId, error.message, 400);
    }
  }
}
