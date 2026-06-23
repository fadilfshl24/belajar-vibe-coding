import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { InventoryModel } from "./inventory.model";

export class InventoryController {
  static async getAll(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const page = parseInt((ctx.query.page as string) ?? "1", 10);
      const limit = parseInt((ctx.query.limit as string) ?? "10", 10);
      const searchTerm = (ctx.query.searchTerm as string | undefined) || undefined;
      const warehouseId = (ctx.query.warehouseId as string | undefined) || undefined;
      const itemId = (ctx.query.itemId as string | undefined) || undefined;

      const [totalRecord, records] = await Promise.all([
        InventoryModel.countAll({ searchTerm, warehouseId, itemId }),
        InventoryModel.findAll({ page, limit, searchTerm, warehouseId, itemId }),
      ]);

      const totalPage = Math.ceil(totalRecord / limit);

      const pagination: PaginationMeta = {
        page,
        limit,
        totalRecord,
        totalPage,
        nextPage: page < totalPage,
        previousPage: page > 1,
        nextPageURL: "",
        previousPageURL: "",
        filterColumn: "",
        searchTerm: searchTerm ?? "",
        orderBy: "",
      };

      return successResponse(correlationId, "Data found!", { records }, pagination);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
