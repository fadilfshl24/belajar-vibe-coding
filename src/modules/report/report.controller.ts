import type { Context } from "elysia";
import { failedResponse, successResponse } from "../../core/utils/response";
import { db } from "../../core/db";
import { itemPriceHistories, items } from "../item/item.schema";
import { vendors } from "../vendor/vendor.schema";
import { desc, eq, and, sql } from "drizzle-orm";

export class ReportController {
  static async getPriceHistory(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const page = parseInt(ctx.query.page || "1", 10);
      const limit = parseInt(ctx.query.limit || "100", 10);
      const itemId = ctx.query.itemId;
      const vendorId = ctx.query.vendorId;
      
      const offset = (page - 1) * limit;

      const conditions = [sql`${itemPriceHistories.deletedAt} IS NULL`];
      
      if (itemId) {
        conditions.push(eq(itemPriceHistories.itemId, itemId));
      }
      if (vendorId) {
        conditions.push(eq(itemPriceHistories.vendorId, vendorId));
      }

      const rows = await db
        .select({
           id: itemPriceHistories.id,
           price: itemPriceHistories.price,
           sourceType: itemPriceHistories.sourceType,
           effectiveDate: itemPriceHistories.effectiveDate,
           item: {
             id: items.id,
             name: items.name,
             code: items.code,
           },
           vendor: {
             id: vendors.id,
             name: vendors.name,
           }
        })
        .from(itemPriceHistories)
        .innerJoin(items, eq(itemPriceHistories.itemId, items.id))
        .innerJoin(vendors, eq(itemPriceHistories.vendorId, vendors.id))
        .where(and(...conditions))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(itemPriceHistories.effectiveDate), desc(itemPriceHistories.createdAt));

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(itemPriceHistories)
        .where(and(...conditions));
        
      const totalCount = Number(countResult.count);

      const meta = {
        page: page,
        limit: limit,
        totalRecord: totalCount,
        totalPage: Math.ceil(totalCount / limit),
        nextPage: page < Math.ceil(totalCount / limit),
        previousPage: page > 1,
        nextPageURL: "",
        previousPageURL: "",
        filterColumn: "",
        searchTerm: "",
        orderBy: "",
      };

      return successResponse(correlationId, "Success", rows, meta);

    } catch (error: any) {
      console.error(error);
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, error.message);
    }
  }
}
