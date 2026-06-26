import { Elysia } from "elysia";
import { PurchaseRequestModel } from "./purchase-request.model";
import {
  parseCreatePRInput,
  parseUpdatePRInput,
  parsePRListQuery,
  parsePatchPRStatus,
  type CreatePRInput,
  type UpdatePRInput,
  type PatchPRStatusInput,
} from "./purchase-request.validation";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "../../core/utils/response";
import { formatZodErrors } from "../../core/utils/zod";
import { requirePermission } from "../../core/middleware/auth";

export class PurchaseRequestController {
  public static routes = new Elysia({ prefix: "/api/purchase-requests" })
    .use(requirePermission("purchase_request.read"))
    .get("/", async (ctx) => {
      try {
        const parsed = parsePRListQuery(ctx.query);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Invalid query parameters", formatZodErrors(parsed.error));
        }

        const params = parsed.data;
        const [records, totalRecord] = await Promise.all([
          PurchaseRequestModel.findAll(params),
          PurchaseRequestModel.countAll(params),
        ]);

        return paginatedResponse(records, {
          page: params.page,
          limit: params.limit,
          totalRecord,
        });
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to fetch purchase requests", error);
      }
    })
    .get("/:id", async (ctx) => {
      try {
        const pr = await PurchaseRequestModel.findById(ctx.params.id);
        if (!pr) {
          ctx.set.status = 404;
          return errorResponse("Purchase request not found");
        }
        return successResponse(pr);
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to fetch purchase request details", error);
      }
    })
    .use(requirePermission("purchase_request.create"))
    .post("/", async (ctx) => {
      try {
        const parsed = parseCreatePRInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        // Context must have user from auth middleware
        const userId = (ctx as any).user?.id;
        if (!userId) {
          ctx.set.status = 401;
          return errorResponse("Unauthorized user");
        }

        const newPR = await PurchaseRequestModel.create(parsed.data as CreatePRInput, userId);
        ctx.set.status = 201;
        return successResponse(newPR, "Purchase request created successfully");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to create purchase request", error);
      }
    })
    .use(requirePermission("purchase_request.update"))
    .put("/:id", async (ctx) => {
      try {
        const pr = await PurchaseRequestModel.findById(ctx.params.id);
        if (!pr) {
          ctx.set.status = 404;
          return errorResponse("Purchase request not found");
        }
        if (pr.status !== 0) {
          ctx.set.status = 400;
          return errorResponse("Only draft purchase requests can be updated");
        }

        const parsed = parseUpdatePRInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        const updated = await PurchaseRequestModel.update(ctx.params.id, parsed.data as UpdatePRInput);
        return successResponse(updated, "Purchase request updated successfully");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to update purchase request", error);
      }
    })
    .patch("/:id/status", async (ctx) => {
      try {
        const parsed = parsePatchPRStatus(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        const pr = await PurchaseRequestModel.findById(ctx.params.id);
        if (!pr) {
          ctx.set.status = 404;
          return errorResponse("Purchase request not found");
        }

        const userId = (ctx as any).user?.id;
        
        const updated = await PurchaseRequestModel.patchStatus(ctx.params.id, parsed.data.status, userId);
        return successResponse(updated, "Purchase request status updated");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to update status", error);
      }
    })
    .use(requirePermission("purchase_request.delete"))
    .delete("/:id", async (ctx) => {
      try {
        const pr = await PurchaseRequestModel.findById(ctx.params.id);
        if (!pr) {
          ctx.set.status = 404;
          return errorResponse("Purchase request not found");
        }
        if (pr.status !== 0) {
          ctx.set.status = 400;
          return errorResponse("Only draft purchase requests can be deleted");
        }

        const deleted = await PurchaseRequestModel.softDelete(ctx.params.id);
        return successResponse(null, "Purchase request deleted successfully");
      } catch (error: any) {
        ctx.set.status = 500;
        return errorResponse("Failed to delete purchase request", error.message);
      }
    });
}
