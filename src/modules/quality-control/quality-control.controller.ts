import { Elysia } from "elysia";
import { QualityControlModel } from "./quality-control.model";
import { createQualityControlSchema, qualityControlListQuerySchema, approveQualityControlSchema } from "./quality-control.validation";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { authMiddleware } from "../auth/auth.middleware";

export const qualityControlController = new Elysia()
  .use(authMiddleware)
  .get("/", async (ctx: any) => {
    const correlationId = crypto.randomUUID();
    try {
      const userId = ctx.user?.sub || ctx.user?.id;
      const parsedQuery = qualityControlListQuerySchema.parse(ctx.query);
      const result = await QualityControlModel.findAll(parsedQuery, userId);
      
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

      return successResponse(correlationId, "Quality Controls retrieved successfully", { records: result.data }, pagination);
    } catch (error: any) {
      ctx.set.status = 400;
      return failedResponse(correlationId, "Failed to retrieve Quality Controls", 400, error.message);
    }
  })
  .get("/:id", async ({ params: { id }, set }) => {
    const correlationId = crypto.randomUUID();
    try {
      const qc = await QualityControlModel.findById(id);
      if (!qc) {
        set.status = 404;
        return failedResponse(correlationId, "Quality Control not found", 404);
      }
      return successResponse(correlationId, "Quality Control retrieved successfully", { record: qc });
    } catch (error: any) {
      set.status = 400;
      return failedResponse(correlationId, "Failed to retrieve Quality Control", 400, error.message);
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

      const parsedBody = createQualityControlSchema.parse(ctx.body);
      const qc = await QualityControlModel.create(parsedBody, userId);

      ctx.set.status = 201;
      return successResponse(correlationId, "Quality Control created successfully", { record: qc });
    } catch (error: any) {
      ctx.set.status = 400;
      return failedResponse(correlationId, "Failed to create Quality Control", 400, error.message);
    }
  })
  .post("/:id/approve", async (ctx: any) => {
    const correlationId = crypto.randomUUID();
    try {
      const userId = ctx.user?.sub || ctx.user?.id;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const parsedBody = approveQualityControlSchema.parse(ctx.body || {});
      const qc = await QualityControlModel.approve(ctx.params.id, userId, parsedBody.remark || undefined);

      ctx.set.status = 200;
      return successResponse(correlationId, "Quality Control approved successfully", { record: qc });
    } catch (error: any) {
      ctx.set.status = 400;
      return failedResponse(correlationId, "Failed to approve Quality Control", 400, error.message);
    }
  })
  .post("/:id/reject", async (ctx: any) => {
    const correlationId = crypto.randomUUID();
    try {
      const userId = ctx.user?.sub || ctx.user?.id;
      if (!userId) {
        ctx.set.status = 401;
        return failedResponse(correlationId, "Unauthorized", 401);
      }

      const parsedBody = approveQualityControlSchema.parse(ctx.body || {});
      const qc = await QualityControlModel.reject(ctx.params.id, userId, parsedBody.remark || "Rejected");

      ctx.set.status = 200;
      return successResponse(correlationId, "Quality Control rejected successfully", { record: qc });
    } catch (error: any) {
      ctx.set.status = 400;
      return failedResponse(correlationId, "Failed to reject Quality Control", 400, error.message);
    }
  });
