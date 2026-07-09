import { Elysia, t } from "elysia";
import { GoodsReceiptModel } from "./goods-receipt.model";
import { createGoodsReceiptSchema, goodsReceiptListQuerySchema } from "./goods-receipt.validation";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { authMiddleware } from "../auth/auth.middleware";

export const goodsReceiptController = new Elysia()
  .use(authMiddleware)
  .get("/", async ({ query, set }) => {
    const correlationId = crypto.randomUUID();
    try {
      const parsedQuery = goodsReceiptListQuerySchema.parse(query);
      const result = await GoodsReceiptModel.findAll(parsedQuery);
      
      const pagination: PaginationMeta = {
        page: result.page,
        limit: result.limit,
        totalRecord: result.total,
        totalPage: result.totalPages,
        nextPage: result.page < result.totalPages,
        previousPage: result.page > 1,
        nextPageURL: "",
        previousPageURL: "",
        filterColumn: parsedQuery.filterColumn ?? "",
        searchTerm: parsedQuery.search ?? "",
        orderBy: "",
      };

      return successResponse(correlationId, "Goods Receipts retrieved successfully", { records: result.data }, pagination);
    } catch (error: any) {
      set.status = 400;
      return failedResponse(correlationId, "Failed to retrieve Goods Receipts", 400, error.message);
    }
  })
  .get("/:id", async ({ params: { id }, set }) => {
    const correlationId = crypto.randomUUID();
    try {
      const gr = await GoodsReceiptModel.findById(id);
      if (!gr) {
        set.status = 404;
        return failedResponse(correlationId, "Goods Receipt not found", 404);
      }
      return successResponse(correlationId, "Goods Receipt retrieved successfully", { record: gr });
    } catch (error: any) {
      set.status = 400;
      return failedResponse(correlationId, "Failed to retrieve Goods Receipt", 400, error.message);
    }
  })
  .post("/", async (ctx: any) => {
    const correlationId = crypto.randomUUID();
    try {
      const userId = ctx.user?.sub || ctx.user?.id;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const parsedBody = createGoodsReceiptSchema.parse(ctx.body);
      const gr = await GoodsReceiptModel.create(parsedBody, userId);

      ctx.set.status = 201;
      return successResponse(correlationId, "Goods Receipt created successfully", { record: gr });
    } catch (error: any) {
      ctx.set.status = 400;
      return failedResponse(correlationId, "Failed to create Goods Receipt", 400, error.message);
    }
  });
