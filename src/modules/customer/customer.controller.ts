import type { Context } from "elysia";
import { CustomerModel } from "./customer.model";
import {
  parseCreateCustomerInput,
  parseUpdateCustomerInput,
  parseCustomerListQuery,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "./customer.validation";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import type { JwtPayload } from "../../core/types/JwtPayload";
import { logActivity } from "../../core/utils/activityLogger";

export class CustomerController {
  static async getAll(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCustomerListQuery(ctx.query);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Invalid query parameters", 400, parsed.error.issues[0]?.message);
      }

      const params = parsed.data;
      const [totalRecord, records] = await Promise.all([
        CustomerModel.countAll(params),
        CustomerModel.findAll(params),
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
      const customer = await CustomerModel.findById(id);
      if (!customer) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Customer not found", 404);
      }
      return successResponse(correlationId, "Data found!", { record: customer });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async create(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCreateCustomerInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      const existing = await CustomerModel.findByCode(parsed.data.code);
      if (existing) {
        ctx.set.status = 409;
        return failedResponse(correlationId, "Customer code already exists", 409);
      }

      const newCustomer = await CustomerModel.create(parsed.data as CreateCustomerInput);
      
      await logActivity({
        userId: ctx.user?.sub,
        action: "CREATE_DATA",
        module: "CUSTOMER",
        description: `User ${ctx.user?.email} menambahkan data Customer "${newCustomer.name}" dengan ID ${newCustomer.id}`,
      });
      
      ctx.set.status = 201;
      return successResponse(correlationId, "Customer created successfully", { record: newCustomer });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to create customer", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async update(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id;
      const parsed = parseUpdateCustomerInput(ctx.body);
      if (!parsed.success) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Validation error", 400, parsed.error.issues[0]?.message);
      }

      if (parsed.data.code) {
        const existing = await CustomerModel.findByCode(parsed.data.code);
        if (existing && existing.id !== id) {
          ctx.set.status = 409;
          return failedResponse(correlationId, "Customer code already in use", 409);
        }
      }

      const updated = await CustomerModel.update(id, parsed.data as UpdateCustomerInput);
      if (!updated) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Customer not found", 404);
      }

      await logActivity({
        userId: ctx.user?.sub,
        action: "UPDATE_DATA",
        module: "CUSTOMER",
        description: `User ${ctx.user?.email} memperbarui data Customer "${updated.name}" dengan ID ${updated.id}`,
      });

      return successResponse(correlationId, "Customer updated successfully", { record: updated });
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to update customer", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async delete(ctx: Context & { user?: JwtPayload }) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string>).id;
      const deleted = await CustomerModel.softDelete(id);
      if (!deleted) {
        ctx.set.status = 404;
        return failedResponse(correlationId, "Customer not found or already deleted", 404);
      }

      await logActivity({
        userId: ctx.user?.sub,
        action: "DELETE_DATA",
        module: "CUSTOMER",
        description: `User ${ctx.user?.email} menghapus data Customer dengan ID ${id}`,
      });

      return successResponse(correlationId, "Customer deleted successfully", null);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to delete customer", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
