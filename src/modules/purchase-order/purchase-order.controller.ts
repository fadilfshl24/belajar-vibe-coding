import type { Context } from "elysia";
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
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { logActivity } from "../../core/utils/activityLogger";

export class PurchaseOrderController {
  static async getAll(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parsePOListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query parameters", 400, parsed.error.issues[0]?.message);
      }

      const params = parsed.data;
      const [totalRecord, records] = await Promise.all([
        PurchaseOrderModel.countAll(params),
        PurchaseOrderModel.findAll(params),
      ]);

      const totalPage = Math.ceil(totalRecord / params.limit) || 1;

      const pagination: PaginationMeta = {
        page: params.page,
        limit: params.limit,
        totalRecord,
        totalPage,
        nextPage: params.page < totalPage,
        previousPage: params.page > 1,
        nextPageURL: "",
        previousPageURL: "",
        filterColumn: "",
        searchTerm: params.searchTerm ?? "",
        orderBy: "",
      };

      return successResponse(correlationId, "Data found!", { records }, pagination);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async getById(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id;
      const po = await PurchaseOrderModel.findById(id);
      if (!po) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Purchase order not found", 404);
      }
      return successResponse(correlationId, "Data found!", { record: po });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCreatePOInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const newPO = await PurchaseOrderModel.create(parsed.data as CreatePOInput);

      await logActivity({
        userId: ctx.user?.sub,
        action: "CREATE_ORDER",
        module: "PURCHASE_ORDER",
        description: `User ${ctx.user?.email} membuat Purchase Order "${newPO.code}" dengan ID ${newPO.id}`,
      });

      ctx.set.status = 201;
      return successResponse(correlationId, "Purchase order created successfully", { record: newPO });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to create purchase order", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async update(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id;
      const po = await PurchaseOrderModel.findById(id);
      if (!po) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Purchase order not found", 404);
      }
      if (po.status !== 0) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Only draft purchase orders can be updated", 400);
      }

      const parsed = parseUpdatePOInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const updated = await PurchaseOrderModel.update(id, parsed.data as UpdatePOInput);

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_ORDER",
        module: "PURCHASE_ORDER",
        description: `User ${ctx.user?.email} memperbarui Purchase Order "${updated.code}" dengan ID ${updated.id}`,
      });

      return successResponse(correlationId, "Purchase order updated successfully", { record: updated });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to update purchase order", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async updateStatus(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id;
      const parsed = parsePatchPOStatus(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const po = await PurchaseOrderModel.findById(id);
      if (!po) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Purchase order not found", 404);
      }

      const updated = await PurchaseOrderModel.patchStatus(id, parsed.data.status);

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_ORDER",
        module: "PURCHASE_ORDER",
        description: `User ${ctx.user?.email} mengubah status Purchase Order "${updated.code}" menjadi ${parsed.data.status}`,
      });

      return successResponse(correlationId, "Purchase order status updated", { record: updated });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to update status", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async receiveGoods(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id;
      const parsed = parseReceiveGoodsInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const po = await PurchaseOrderModel.findById(id);
      if (!po) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Purchase order not found", 404);
      }
      
      if (po.status === 0 || po.status === 3 || po.status === 4) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Cannot receive goods for this PO status", 400);
      }

      const updated = await PurchaseOrderModel.receiveGoods(id, parsed.data.items);

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_ORDER",
        module: "PURCHASE_ORDER",
        description: `User ${ctx.user?.email} mencatat penerimaan barang untuk Purchase Order "${updated.code}"`,
      });

      return successResponse(correlationId, "Goods receipt recorded successfully", { record: updated });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to record goods receipt", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async delete(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id;
      const po = await PurchaseOrderModel.findById(id);
      if (!po) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Purchase order not found", 404);
      }
      if (po.status !== 0) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Only draft purchase orders can be deleted", 400);
      }

      const deleted = await PurchaseOrderModel.softDelete(id);

      await logActivity({
        userId: ctx.user?.sub,
        action: "DELETE_ORDER",
        module: "PURCHASE_ORDER",
        description: `User ${ctx.user?.email} menghapus Purchase Order "${po.code}"`,
      });

      return successResponse(correlationId, "Purchase order deleted successfully", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to delete purchase order", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
