import bcrypt from "bcryptjs";
import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../utils/response";
import { validateRegisterInput } from "../validations/userValidation";
import { UserModel } from "../models/UserModel";
import { toUserDTO } from "../dto/UserDTO";

const BCRYPT_SALT_ROUNDS = 10;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ORDER_BY = "{'CreatedAt':'DESC'}";

export class UserController {
  // ---------------------------------------------------------------------------
  // POST / — Register a new user
  // ---------------------------------------------------------------------------
  static async register(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    try {
      const validation = validateRegisterInput(ctx.body);
      if (!validation.valid) {
        return failedResponse(
          correlationId,
          "Create data failed!",
          400,
          validation.error ?? "Input data not found or invalid!"
        );
      }

      const { name, email, password } = ctx.body as {
        name: string;
        email: string;
        password: string;
      };

      const existingUser = await UserModel.findByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return failedResponse(
          correlationId,
          "Create data failed!",
          400,
          "Email already registered"
        );
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      await UserModel.createUser({ name, email, password: hashedPassword });

      return successResponse(correlationId, "Data has been created", null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // GET / — Get all users (paginated)
  // ---------------------------------------------------------------------------
  static async getAll(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    try {
      const query = ctx.query as Record<string, string | undefined>;

      const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
      const rawLimit = parseInt(query.limit ?? "10", 10) || 10;
      // limit=1000 is the convention for "fetch all"
      const internalLimit = rawLimit === 1000 ? Number.MAX_SAFE_INTEGER : rawLimit;
      const filterColumn = query.filterColumn ?? "";
      const searchTerm = query.searchTerm ?? "";
      const orderBy = query.orderBy ?? DEFAULT_ORDER_BY;

      const [totalRecord, records] = await Promise.all([
        UserModel.countAll(searchTerm || undefined, filterColumn || undefined),
        UserModel.findAll({
          page,
          limit: internalLimit,
          orderBy,
          searchTerm: searchTerm || undefined,
          filterColumn: filterColumn || undefined,
        }),
      ]);

      const totalPage = rawLimit === 1000 ? 1 : Math.ceil(totalRecord / rawLimit);
      const hasNext = page < totalPage;
      const hasPrev = page > 1;

      const baseUrl =
        (process.env.APP_URL ?? "http://localhost:3000") + "/api/users";

      const buildUrl = (p: number) => {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(rawLimit),
          ...(filterColumn ? { filterColumn } : {}),
          ...(searchTerm ? { searchTerm } : {}),
          ...(orderBy !== DEFAULT_ORDER_BY ? { orderBy } : {}),
        });
        return `${baseUrl}?${params.toString()}`;
      };

      const pagination: PaginationMeta = {
        page,
        limit: rawLimit,
        totalRecord,
        totalPage,
        nextPage: hasNext,
        previousPage: hasPrev,
        nextPageURL: hasNext ? buildUrl(page + 1) : "",
        previousPageURL: hasPrev ? buildUrl(page - 1) : "",
        filterColumn,
        searchTerm,
        orderBy,
      };

      return successResponse(
        correlationId,
        "Data found!",
        { records },
        pagination
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // GET /:id — Get a single user by UUID
  // ---------------------------------------------------------------------------
  static async getById(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string | undefined>).id ?? "";

      if (!UUID_REGEX.test(id)) {
        return failedResponse(
          correlationId,
          "Data not found!",
          400,
          "Invalid UUID format"
        );
      }

      const user = await UserModel.findById(id);
      if (!user) {
        return failedResponse(correlationId, "Data not found!", 400);
      }

      return successResponse(correlationId, "Data found!", { record: toUserDTO(user) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // PATCH /:id/status — Update user status (0 or 1)
  // ---------------------------------------------------------------------------
  static async updateStatus(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string | undefined>).id ?? "";

      if (!UUID_REGEX.test(id)) {
        return failedResponse(
          correlationId,
          "Update data failed!",
          400,
          "Invalid UUID format"
        );
      }

      const body = ctx.body as Record<string, unknown> | undefined;
      const status = body?.status;

      if (status === undefined || (status !== 0 && status !== 1)) {
        return failedResponse(
          correlationId,
          "Update data failed!",
          400,
          "Field 'status' must be 0 or 1"
        );
      }

      const existingUser = await UserModel.findById(id);
      if (!existingUser) {
        return failedResponse(correlationId, "Data not found!", 400);
      }

      await UserModel.updateStatus(id, status as 0 | 1);

      return successResponse(correlationId, "Data has been updated", null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE /:id — Hard delete a user
  // ---------------------------------------------------------------------------
  static async deleteUser(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string | undefined>).id ?? "";

      if (!UUID_REGEX.test(id)) {
        return failedResponse(
          correlationId,
          "Delete data failed!",
          400,
          "Invalid UUID format"
        );
      }

      const existingUser = await UserModel.findById(id);
      if (!existingUser) {
        return failedResponse(correlationId, "Data not found!", 400);
      }

      await UserModel.deleteById(id);

      return successResponse(correlationId, "Data has been deleted", null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }
}
