import { Elysia } from "elysia";
import { CustomerModel } from "./customer.model";
import {
  parseCreateCustomerInput,
  parseUpdateCustomerInput,
  parseCustomerListQuery,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "./customer.validation";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "../../core/utils/response";
import { requirePermission } from "../../core/middleware/auth";
import { formatZodErrors } from "../../core/utils/zod";

export class CustomerController {
  public static routes = new Elysia({ prefix: "/api/customers" })
    .use(requirePermission("customer.read"))
    .get("/", async (ctx) => {
      try {
        const parsed = parseCustomerListQuery(ctx.query);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Invalid query parameters", formatZodErrors(parsed.error));
        }

        const params = parsed.data;
        const [records, totalRecord] = await Promise.all([
          CustomerModel.findAll(params),
          CustomerModel.countAll(params),
        ]);

        return paginatedResponse(records, {
          page: params.page,
          limit: params.limit,
          totalRecord,
        });
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to fetch customers", error);
      }
    })
    .get("/:id", async (ctx) => {
      try {
        const customer = await CustomerModel.findById(ctx.params.id);
        if (!customer) {
          ctx.set.status = 404;
          return errorResponse("Customer not found");
        }
        return successResponse(customer);
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to fetch customer details", error);
      }
    })
    .use(requirePermission("customer.create"))
    .post("/", async (ctx) => {
      try {
        const parsed = parseCreateCustomerInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        const existing = await CustomerModel.findByCode(parsed.data.code);
        if (existing) {
          ctx.set.status = 409;
          return errorResponse("Customer code already exists");
        }

        const newCustomer = await CustomerModel.create(parsed.data as CreateCustomerInput);
        ctx.set.status = 201;
        return successResponse(newCustomer, "Customer created successfully");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to create customer", error);
      }
    })
    .use(requirePermission("customer.update"))
    .put("/:id", async (ctx) => {
      try {
        const parsed = parseUpdateCustomerInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        if (parsed.data.code) {
          const existing = await CustomerModel.findByCode(parsed.data.code);
          if (existing && existing.id !== ctx.params.id) {
            ctx.set.status = 409;
            return errorResponse("Customer code already in use");
          }
        }

        const updated = await CustomerModel.update(ctx.params.id, parsed.data as UpdateCustomerInput);
        if (!updated) {
          ctx.set.status = 404;
          return errorResponse("Customer not found");
        }

        return successResponse(updated, "Customer updated successfully");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to update customer", error);
      }
    })
    .use(requirePermission("customer.delete"))
    .delete("/:id", async (ctx) => {
      try {
        const deleted = await CustomerModel.softDelete(ctx.params.id);
        if (!deleted) {
          ctx.set.status = 404;
          return errorResponse("Customer not found or already deleted");
        }
        return successResponse(null, "Customer deleted successfully");
      } catch (error: any) {
        ctx.set.status = 500;
        return errorResponse("Failed to delete customer", error.message);
      }
    });
}
