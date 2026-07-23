import type { Context } from "elysia";
import { StockOrderModel } from "./stock-order.model";
import {
  parseImportStockOrder,
  parseListStockOrderQuery,
  parsePackWithMapping,
  parseProcessReturn,
} from "./stock-order.validation";
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
  // ── IMPORT EXCEL ────────────────────────────────────────────────────────────

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

      const [platform] = await db.select().from(platforms).where(
        sql`UPPER(${platforms.code}) = ${purchaseChannel.toUpperCase()}`
      ).limit(1);

      if (!platform) {
        ctx.set.status = 400;
        return failedResponse(correlationId, `Platform ${purchaseChannel} tidak ditemukan`, 400);
      }

      const allSkus = await db.select().from(itemPlatformSkus)
        .where(and(eq(itemPlatformSkus.platformId, platform.id), isNull(itemPlatformSkus.deletedAt)));

      const skuMap = new Map(allSkus.map(s => [s.platformSku.toUpperCase(), s.itemId]));

      const stockOrdersMap = new Map<string, { order: StockOrderInsert; items: StockOrderItemInsert[] }>();

      for (const row of jsonData) {
        let orderId = "", trackingId = "", skuId = "", skuName = "", paymentMethod = "", 
        shippingProviderName = "", buyerUsername = "", recipient = "", phone = "", 
        createdAt = "", paidAt = "", rtsAt = "",
        sellerNote = "";
        let quantity = 0;

        if (purchaseChannel === "TikTok") {
          orderId = row["Order ID"]?.toString() || "";
          trackingId = row["Tracking ID"]?.toString() || "";
          skuId = row["SKU ID"]?.toString() || row["Seller SKU"]?.toString() || "";
          skuName = row["Product Name"]?.toString() || "";
          quantity = Number(row["Quantity"]) || 0;
          paymentMethod = row["Payment Method"]?.toString() || null;
          shippingProviderName = row["Shipping Provider Name"]?.toString() || null;
          buyerUsername = row["Buyer Username"]?.toString() || null;
          recipient = row["Recipient"]?.toString() || null;
          phone = row["Phone #"]?.toString() || null;
          sellerNote = row["Seller Note"]?.toString() || null;
          createdAt = row["Created Time"]?.toString() || null;
          paidAt = row["Paid Time"]?.toString() || null;
          rtsAt = row["RTS Time"]?.toString() || null;
        } else {
          orderId = row["Order ID"]?.toString() || row["order_id"]?.toString() || "";
          trackingId = row["Tracking ID"]?.toString() || row["tracking_id"]?.toString() || row["Resi"]?.toString() || "";
          skuId = row["SKU ID"]?.toString() || row["sku"]?.toString() || "";
          skuName = row["Product Name"]?.toString() || row["product_name"]?.toString() || "";
          quantity = Number(row["Quantity"]) || Number(row["quantity"]) || 0;
        }

        if (!trackingId || !skuId) continue;

        const itemId = skuMap.get(skuId.toUpperCase());

        if (!itemId) {
          ctx.set.status = 400;
          return failedResponse(correlationId, `SKU ${skuId} (${skuName}) belum di-mapping di sistem.`, 400);
        }

        const parseDate = (val: any): Date | null => {
          if (!val) return null;
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d;
        };

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
              platformCreatedAt: parseDate(createdAt),
              platformPaidAt: parseDate(paidAt),
              platformRTSAt: parseDate(rtsAt),
              createdBy: userId,
            },
            items: [],
          });
        }

        stockOrdersMap.get(trackingId)!.items.push({
          stockOrderId: "",
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
          const existing = await StockOrderModel.findByTrackingId(trackingId);
          if (existing) continue;
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

  static async previewImport(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const body = ctx.body as { file?: File; purchaseChannel?: string; warehouseId?: string };
      const parsed = parseImportStockOrder(body);

      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid parameters", 400, parsed.error.format());
      }

      if (!body.file || !(body.file instanceof File)) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Excel file is required", 400);
      }

      const { purchaseChannel } = parsed.data;

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

      const [platform] = await db.select().from(platforms).where(
        sql`UPPER(${platforms.code}) = ${purchaseChannel.toUpperCase()}`
      ).limit(1);

      if (!platform) {
        ctx.set.status = 400;
        return failedResponse(correlationId, `Platform ${purchaseChannel} tidak ditemukan`, 400);
      }

      const allSkus = await db.select().from(itemPlatformSkus)
        .where(and(eq(itemPlatformSkus.platformId, platform.id), isNull(itemPlatformSkus.deletedAt)));

      const skuMap = new Map(allSkus.map(s => [s.platformSku.toUpperCase(), s.itemId]));

      const trackingIds = new Set<string>();
      const unmappedSkus: string[] = [];

      for (const row of jsonData) {
        let trackingId = "";
        let skuId = "";

        if (purchaseChannel === "TikTok") {
          trackingId = row["Tracking ID"]?.toString() || "";
          skuId = row["SKU ID"]?.toString() || row["Seller SKU"]?.toString() || "";
        } else {
          trackingId = row["Tracking ID"]?.toString() || row["tracking_id"]?.toString() || row["Resi"]?.toString() || "";
          skuId = row["SKU ID"]?.toString() || row["sku"]?.toString() || "";
        }

        if (!trackingId || !skuId) continue;

        const itemId = skuMap.get(skuId.toUpperCase());
        if (!itemId && !unmappedSkus.includes(skuId)) {
          unmappedSkus.push(skuId);
        }

        trackingIds.add(trackingId);
      }

      if (unmappedSkus.length > 0) {
        ctx.set.status = 400;
        return failedResponse(correlationId, `Terdapat SKU belum di-mapping: ${unmappedSkus.join(", ")}`, 400);
      }

      const totalResi = trackingIds.size;

      return successResponse(correlationId, "Preview import berhasil", {
        totalResi,
        totalRows: jsonData.length,
      });
    } catch (error: any) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to preview import file", 500, error.message);
    }
  }

  // ── LIST ────────────────────────────────────────────────────────────────────

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

  // ── GET BY TRACKING ID (legacy) ─────────────────────────────────────────────

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

  // ── SCAN OUTBOUND ───────────────────────────────────────────────────────────

  /**
   * GET /stock-orders/scan/outbound/:trackingId
   * Scan resi untuk outbound. Returns data resi + platform items + available stock.
   */
  static async scanOutbound(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const userId = ctx.user?.sub;
    const { trackingId } = ctx.params as { trackingId: string };

    if (!userId) {
      ctx.set.status = 401;
      return failedResponse(correlationId, "Unauthorized", 401);
    }

    try {
      const result = await StockOrderModel.scanForOutbound(trackingId, userId);
      return successResponse(correlationId, "Scan berhasil", result);
    } catch (error: any) {
      const code = error?.code ?? 400;
      ctx.set.status = 200;
      return failedResponse(correlationId, error?.message ?? "Internal server error", code, error?.data);
    }
  }

  // ── PACK WITH MAPPING ───────────────────────────────────────────────────────

  /**
   * POST /stock-orders/:id/pack-with-mapping
   * Konfirmasi packing dengan item mapping fisik.
   */
  static async packWithMapping(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const userId = ctx.user?.sub;
    const { id } = ctx.params as { id: string };

    if (!userId) {
      ctx.set.status = 401;
      return failedResponse(correlationId, "Unauthorized", 401);
    }

    try {
      const parsed = parsePackWithMapping(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid request body", 400, parsed.error.issues[0]?.message);
      }

      const updated = await StockOrderModel.packWithMapping(id, userId, parsed.data);

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "OUTBOUND_PACKED",
        description: `Order ${updated?.trackingId} di-pack dengan ${parsed.data.mappedItems.length} item mapping`,
      });

      return successResponse(correlationId, "Order berhasil di-pack", updated);
    } catch (error: any) {
      const code = error?.code ?? 400;
      ctx.set.status = code;
      return failedResponse(correlationId, error?.message ?? "Gagal packing", code);
    }
  }

  // ── SCAN INBOUND ────────────────────────────────────────────────────────────

  /**
   * GET /stock-orders/scan/inbound/:trackingId
   * Scan resi untuk inbound return. Returns data resi + item mappings dari outbound.
   */
  static async scanInbound(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const userId = ctx.user?.sub;
    const { trackingId } = ctx.params as { trackingId: string };

    if (!userId) {
      ctx.set.status = 401;
      return failedResponse(correlationId, "Unauthorized", 401);
    }

    try {
      const result = await StockOrderModel.scanForInbound(trackingId, userId);
      return successResponse(correlationId, "Scan retur berhasil", result);
    } catch (error: any) {
      const code = error?.code ?? 400;
      ctx.set.status = 200;
      return failedResponse(correlationId, error?.message ?? "Internal server error", code, error?.data);
    }
  }

  // ── PROCESS RETURN ──────────────────────────────────────────────────────────

  /**
   * POST /stock-orders/:id/process-return
   * Proses parsial return dengan bukti foto.
   */
  static async processReturn(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const userId = ctx.user?.sub;
    const { id } = ctx.params as { id: string };

    if (!userId) {
      ctx.set.status = 401;
      return failedResponse(correlationId, "Unauthorized", 401);
    }

    try {
      const parsed = parseProcessReturn(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid request body", 400, parsed.error.issues[0]?.message);
      }

      const result = await StockOrderModel.processReturn(id, userId, parsed.data);

      await logActivity({
        userId,
        module: MODULE_TYPE,
        action: "INBOUND_RETURN_PROCESSED",
        description: `Return order ${result.order?.trackingId} — ${parsed.data.returnItems.length} item(s) direturn`,
      });

      return successResponse(correlationId, "Return berhasil diproses", result);
    } catch (error: any) {
      const code = error?.code ?? 400;
      ctx.set.status = code;
      return failedResponse(correlationId, error?.message ?? "Gagal proses return", code);
    }
  }

  // ── PACK ORDER (legacy) ─────────────────────────────────────────────────────

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

  // ── RETURN ORDER (legacy) ───────────────────────────────────────────────────

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
