import type { Context } from "elysia";
import { VendorModel } from "./vendor.model";
import {
  parseCreateVendorInput,
  parseUpdateVendorInput,
  parseVendorListQuery,
  type CreateVendorInput,
  type UpdateVendorInput,
} from "./vendor.validation";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { logActivity } from "../../core/utils/activityLogger";

export class VendorController {
  static async getAll(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseVendorListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query parameters", 400, parsed.error.issues[0]?.message);
      }

      const params = parsed.data;
      const [totalRecord, records] = await Promise.all([
        VendorModel.countAll(params),
        VendorModel.findAll(params),
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
      const id = (ctx.params as Record<string, string>).id ?? "";
      const vendor = await VendorModel.findById(id);
      if (!vendor) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Vendor not found", 404);
      }
      return successResponse(correlationId, "Data found!", { record: vendor });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCreateVendorInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const existing = await VendorModel.findByCode(parsed.data.code);
      if (existing) {
        ctx.set.status = 409;
        return failedResponse(correlationId, "Vendor code already exists", 409);
      }

      const newVendor = await VendorModel.create(parsed.data as CreateVendorInput, ctx.user?.sub);
      
      await logActivity({
        userId: ctx.user?.sub,
        action: "CREATE_DATA",
        module: "VENDOR",
        description: `User ${ctx.user?.email} menambahkan data Vendor "${newVendor.name}" dengan ID ${newVendor.id}`,
      });
      
      ctx.set.status = 201;
      return successResponse(correlationId, "Vendor created successfully", { record: newVendor });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to create vendor", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async update(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      const parsed = parseUpdateVendorInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      if (parsed.data.code) {
        const existing = await VendorModel.findByCode(parsed.data.code);
        if (existing && existing.id !== id) {
          ctx.set.status = 409;
          return failedResponse(correlationId, "Vendor code already in use", 409);
        }
      }

      const updated = await VendorModel.update(id, parsed.data as UpdateVendorInput, ctx.user?.sub);
      if (!updated) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Vendor not found", 404);
      }

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_DATA",
        module: "VENDOR",
        description: `User ${ctx.user?.email} memperbarui data Vendor "${updated.name}" dengan ID ${updated.id}`,
      });

      return successResponse(correlationId, "Vendor updated successfully", { record: updated });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to update vendor", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async delete(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id ?? "";
      const deleted = await VendorModel.softDelete(id);
      if (!deleted) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Vendor not found or already deleted", 404);
      }

      await logActivity({
        userId: ctx.user?.sub,
        action: "DELETE_DATA",
        module: "VENDOR",
        description: `User ${ctx.user?.email} menghapus data Vendor dengan ID ${id}`,
      });

      return successResponse(correlationId, "Vendor deleted successfully", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to delete vendor", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
