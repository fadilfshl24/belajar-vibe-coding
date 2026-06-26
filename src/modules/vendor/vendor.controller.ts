import { Elysia } from "elysia";
import { VendorModel } from "./vendor.model";
import {
  parseCreateVendorInput,
  parseUpdateVendorInput,
  parseVendorListQuery,
  type CreateVendorInput,
  type UpdateVendorInput,
} from "./vendor.validation";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "../../core/utils/response";
import { formatZodErrors } from "../../core/utils/zod";
import { requirePermission } from "../../core/middleware/auth";

export class VendorController {
  public static routes = new Elysia({ prefix: "/api/vendors" })
    .use(requirePermission("vendor.read"))
    .get("/", async (ctx) => {
      try {
        const parsed = parseVendorListQuery(ctx.query);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Invalid query parameters", formatZodErrors(parsed.error));
        }

        const params = parsed.data;
        const [records, totalRecord] = await Promise.all([
          VendorModel.findAll(params),
          VendorModel.countAll(params),
        ]);

        return paginatedResponse(records, {
          page: params.page,
          limit: params.limit,
          totalRecord,
        });
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to fetch vendors", error);
      }
    })
    .get("/:id", async (ctx) => {
      try {
        const vendor = await VendorModel.findById(ctx.params.id);
        if (!vendor) {
          ctx.set.status = 404;
          return errorResponse("Vendor not found");
        }
        return successResponse(vendor);
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to fetch vendor details", error);
      }
    })
    .use(requirePermission("vendor.create"))
    .post("/", async (ctx) => {
      try {
        const parsed = parseCreateVendorInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        const existing = await VendorModel.findByCode(parsed.data.code);
        if (existing) {
          ctx.set.status = 409;
          return errorResponse("Vendor code already exists");
        }

        const newVendor = await VendorModel.create(parsed.data as CreateVendorInput);
        ctx.set.status = 201;
        return successResponse(newVendor, "Vendor created successfully");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to create vendor", error);
      }
    })
    .use(requirePermission("vendor.update"))
    .put("/:id", async (ctx) => {
      try {
        const parsed = parseUpdateVendorInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        if (parsed.data.code) {
          const existing = await VendorModel.findByCode(parsed.data.code);
          if (existing && existing.id !== ctx.params.id) {
            ctx.set.status = 409;
            return errorResponse("Vendor code already in use");
          }
        }

        const updated = await VendorModel.update(ctx.params.id, parsed.data as UpdateVendorInput);
        if (!updated) {
          ctx.set.status = 404;
          return errorResponse("Vendor not found");
        }

        return successResponse(updated, "Vendor updated successfully");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to update vendor", error);
      }
    })
    .use(requirePermission("vendor.delete"))
    .delete("/:id", async (ctx) => {
      try {
        const deleted = await VendorModel.softDelete(ctx.params.id);
        if (!deleted) {
          ctx.set.status = 404;
          return errorResponse("Vendor not found or already deleted");
        }
        return successResponse(null, "Vendor deleted successfully");
      } catch (error: any) {
        ctx.set.status = 500;
        return errorResponse("Failed to delete vendor", error.message);
      }
    });
}
