import { Elysia } from "elysia";
import { PurchaseOrderModel } from "./purchase-order.model";
import {
  parseCreatePOInput,
  parseUpdatePOInput,
  parsePOListQuery,
  parsePatchPOStatus,
  parseReceiveGoodsInput,
  type CreatePOInput,
  type UpdatePOInput,
} from "./purchase-order.validation";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "../../core/utils/response";
import { formatZodErrors } from "../../core/utils/zod";
import { requirePermission } from "../../core/middleware/auth";

export class PurchaseOrderController {
  public static routes = new Elysia({ prefix: "/api/purchase-orders" })
    .use(requirePermission("purchase_order.read"))
    .get("/", async (ctx) => {
      try {
        const parsed = parsePOListQuery(ctx.query);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Invalid query parameters", formatZodErrors(parsed.error));
        }

        const params = parsed.data;
        const [records, totalRecord] = await Promise.all([
          PurchaseOrderModel.findAll(params),
          PurchaseOrderModel.countAll(params),
        ]);

        return paginatedResponse(records, {
          page: params.page,
          limit: params.limit,
          totalRecord,
        });
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to fetch purchase orders", error);
      }
    })
    .get("/:id", async (ctx) => {
      try {
        const po = await PurchaseOrderModel.findById(ctx.params.id);
        if (!po) {
          ctx.set.status = 404;
          return errorResponse("Purchase order not found");
        }
        return successResponse(po);
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to fetch purchase order details", error);
      }
    })
    .use(requirePermission("purchase_order.create"))
    .post("/", async (ctx) => {
      try {
        const parsed = parseCreatePOInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        const newPO = await PurchaseOrderModel.create(parsed.data as CreatePOInput);
        ctx.set.status = 201;
        return successResponse(newPO, "Purchase order created successfully");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to create purchase order", error);
      }
    })
    .use(requirePermission("purchase_order.update"))
    .put("/:id", async (ctx) => {
      try {
        const po = await PurchaseOrderModel.findById(ctx.params.id);
        if (!po) {
          ctx.set.status = 404;
          return errorResponse("Purchase order not found");
        }
        if (po.status !== 0) { // Draft only
          ctx.set.status = 400;
          return errorResponse("Only draft purchase orders can be updated");
        }

        const parsed = parseUpdatePOInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        const updated = await PurchaseOrderModel.update(ctx.params.id, parsed.data as UpdatePOInput);
        return successResponse(updated, "Purchase order updated successfully");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to update purchase order", error);
      }
    })
    .patch("/:id/status", async (ctx) => {
      try {
        const parsed = parsePatchPOStatus(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        const po = await PurchaseOrderModel.findById(ctx.params.id);
        if (!po) {
          ctx.set.status = 404;
          return errorResponse("Purchase order not found");
        }

        const updated = await PurchaseOrderModel.patchStatus(ctx.params.id, parsed.data.status);
        return successResponse(updated, "Purchase order status updated");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to update status", error);
      }
    })
    .post("/:id/receive", async (ctx) => {
      try {
        const parsed = parseReceiveGoodsInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        const po = await PurchaseOrderModel.findById(ctx.params.id);
        if (!po) {
          ctx.set.status = 404;
          return errorResponse("Purchase order not found");
        }
        
        if (po.status === 0 || po.status === 3 || po.status === 4) {
          ctx.set.status = 400;
          return errorResponse("Cannot receive goods for this PO status");
        }

        const updated = await PurchaseOrderModel.receiveGoods(ctx.params.id, parsed.data.items);
        return successResponse(updated, "Goods receipt recorded successfully");
      } catch (error: any) {
        ctx.set.status = 500;
        return errorResponse("Failed to record goods receipt", error.message);
      }
    })
    .use(requirePermission("purchase_order.delete"))
    .delete("/:id", async (ctx) => {
      try {
        const po = await PurchaseOrderModel.findById(ctx.params.id);
        if (!po) {
          ctx.set.status = 404;
          return errorResponse("Purchase order not found");
        }
        if (po.status !== 0) {
          ctx.set.status = 400;
          return errorResponse("Only draft purchase orders can be deleted");
        }

        const deleted = await PurchaseOrderModel.softDelete(ctx.params.id);
        return successResponse(null, "Purchase order deleted successfully");
      } catch (error: any) {
        ctx.set.status = 500;
        return errorResponse("Failed to delete purchase order", error.message);
      }
    });
}
