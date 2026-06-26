import { Elysia } from "elysia";
import { PlatformModel } from "./platform.model";
import {
  parseCreatePlatformInput,
  parseUpdatePlatformInput,
  parsePlatformListQuery,
  type CreatePlatformInput,
  type UpdatePlatformInput,
} from "./platform.validation";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "../../core/utils/response";
import { formatZodErrors } from "../../core/utils/zod";
import { requirePermission } from "../../core/middleware/auth";

export class PlatformController {
  public static routes = new Elysia({ prefix: "/api/platforms" })
    .use(requirePermission("platform.read"))
    .get("/", async (ctx) => {
      try {
        const parsed = parsePlatformListQuery(ctx.query);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Invalid query parameters", formatZodErrors(parsed.error));
        }

        const params = parsed.data;
        const [records, totalRecord] = await Promise.all([
          PlatformModel.findAll(params),
          PlatformModel.countAll(params),
        ]);

        return paginatedResponse(records, {
          page: params.page,
          limit: params.limit,
          totalRecord,
        });
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to fetch platforms", error);
      }
    })
    .get("/:id", async (ctx) => {
      try {
        const platform = await PlatformModel.findById(ctx.params.id);
        if (!platform) {
          ctx.set.status = 404;
          return errorResponse("Platform not found");
        }
        return successResponse(platform);
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to fetch platform details", error);
      }
    })
    .use(requirePermission("platform.create"))
    .post("/", async (ctx) => {
      try {
        const parsed = parseCreatePlatformInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        const existing = await PlatformModel.findByCode(parsed.data.code);
        if (existing) {
          ctx.set.status = 409;
          return errorResponse("Platform code already exists");
        }

        const newPlatform = await PlatformModel.create(parsed.data as CreatePlatformInput);
        ctx.set.status = 201;
        return successResponse(newPlatform, "Platform created successfully");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to create platform", error);
      }
    })
    .use(requirePermission("platform.update"))
    .put("/:id", async (ctx) => {
      try {
        const parsed = parseUpdatePlatformInput(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return errorResponse("Validation error", formatZodErrors(parsed.error));
        }

        if (parsed.data.code) {
          const existing = await PlatformModel.findByCode(parsed.data.code);
          if (existing && existing.id !== ctx.params.id) {
            ctx.set.status = 409;
            return errorResponse("Platform code already in use");
          }
        }

        const updated = await PlatformModel.update(ctx.params.id, parsed.data as UpdatePlatformInput);
        if (!updated) {
          ctx.set.status = 404;
          return errorResponse("Platform not found");
        }

        return successResponse(updated, "Platform updated successfully");
      } catch (error) {
        ctx.set.status = 500;
        return errorResponse("Failed to update platform", error);
      }
    })
    .use(requirePermission("platform.delete"))
    .delete("/:id", async (ctx) => {
      try {
        const deleted = await PlatformModel.softDelete(ctx.params.id);
        if (!deleted) {
          ctx.set.status = 404;
          return errorResponse("Platform not found or already deleted");
        }
        return successResponse(null, "Platform deleted successfully");
      } catch (error: any) {
        ctx.set.status = 500;
        return errorResponse("Failed to delete platform", error.message);
      }
    });
}
