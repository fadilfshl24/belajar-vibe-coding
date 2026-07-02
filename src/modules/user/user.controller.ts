import bcrypt from "bcryptjs";
import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { parseCreateUserInput, parseUpdateUserInput, parseListQuery } from "./user.validation";
import { UserModel } from "./user.model";
import { toUserDTO } from "./user.dto";
import { logActivity } from "../../core/utils/activityLogger";
import type { JwtPayload } from "../../core/types/JwtPayload";

const BCRYPT_SALT_ROUNDS = 10;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ORDER_BY = "{'CreatedAt':'DESC'}";

export class UserController {
  // ---------------------------------------------------------------------------
  // POST /api/users — Register user baru
  // ---------------------------------------------------------------------------
  static async register(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseCreateUserInput(ctx.body);
      if (!parsed.success) {
        return failedResponse(
          correlationId,
          "Create data failed!",
          400,
          parsed.error.issues[0]?.message ?? "Input data not found or invalid!"
        );
      }

      const { name, email, password, roleId, isActive } = parsed.data;

      const existingUser = await UserModel.findByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return failedResponse(correlationId, "Create data failed!", 400, "Email already registered");
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      const newUser = await UserModel.createUser({
        name,
        email,
        password: hashedPassword,
        roleId,
        isActive,
      }, ctx.user?.sub);

      const userAgent = ctx.headers["user-agent"];
      const ipAddress =
        (ctx.headers["x-forwarded-for"] as string | undefined) ??
        (ctx.headers["x-real-ip"] as string | undefined) ??
        "";

      await logActivity({
        userId: newUser.id,
        action: "REGISTER",
        description: `User ${newUser.name} berhasil mendaftar ke sistem`,
        ipAddress,
        userAgent,
      });

      return successResponse(correlationId, "Data has been created", null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // PUT /api/users/:id — Update user
  // ---------------------------------------------------------------------------
  static async updateUser(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string | undefined>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        return failedResponse(correlationId, "Update data failed!", 400, "Invalid UUID format");
      }

      const parsed = parseUpdateUserInput(ctx.body);
      if (!parsed.success) {
        return failedResponse(
          correlationId,
          "Update data failed!",
          400,
          parsed.error.issues[0]?.message ?? "Input data not found or invalid!"
        );
      }

      const existingUser = await UserModel.findById(id);
      if (!existingUser) return failedResponse(correlationId, "Data not found!", 400);

      const { name, email, password, roleId, isActive } = parsed.data;

      // if email is changing, check if already taken
      if (email && email.toLowerCase().trim() !== existingUser.email.toLowerCase().trim()) {
        const existingEmail = await UserModel.findByEmail(email.toLowerCase().trim());
        if (existingEmail) {
          return failedResponse(correlationId, "Update data failed!", 400, "Email already registered");
        }
      }

      const updatePayload: Parameters<typeof UserModel.update>[1] = {
        name,
        email,
        roleId,
        isActive,
      };

      if (password) {
        updatePayload.password = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      }

      const updatedUser = await UserModel.update(id, updatePayload, ctx.user?.sub);
      if (!updatedUser) {
        return failedResponse(correlationId, "Update data failed!", 500, "Failed to update user database record");
      }

      const userAgent = ctx.headers["user-agent"];
      const ipAddress =
        (ctx.headers["x-forwarded-for"] as string | undefined) ??
        (ctx.headers["x-real-ip"] as string | undefined) ??
        "";

      await logActivity({
        userId: updatedUser.id,
        action: "UPDATE_USER",
        description: `User ${updatedUser.name} updated successfully`,
        ipAddress,
        userAgent,
      });

      return successResponse(correlationId, "Data has been updated", null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // GET /api/users — List users (paginated)
  // ---------------------------------------------------------------------------
  static async getAll(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseListQuery(ctx.query);
      if (!parsed.success) {
        return failedResponse(
          correlationId,
          "Get list data failed!",
          400,
          parsed.error.issues[0]?.message ?? "Invalid query parameters"
        );
      }

      const { page, limit: rawLimit, orderBy, searchTerm, filterColumn, status, roleId } = parsed.data;
      const internalLimit = rawLimit === 1000 ? Number.MAX_SAFE_INTEGER : rawLimit;

      const [totalRecord, records] = await Promise.all([
        UserModel.countAll({ searchTerm, filterColumn, status, roleId }),
        UserModel.findAll({
          page,
          limit: internalLimit,
          orderBy,
          searchTerm,
          filterColumn,
          status,
          roleId,
        }),
      ]);

      const totalPage = rawLimit === 1000 ? 1 : Math.ceil(totalRecord / rawLimit);
      const baseUrl = (process.env.APP_URL ?? "http://localhost:3000") + "/api/users";
      const buildUrl = (p: number) => {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(rawLimit),
          ...(filterColumn ? { filterColumn } : {}),
          ...(searchTerm ? { searchTerm } : {}),
          ...(status !== undefined ? { status: String(status) } : {}),
          ...(roleId ? { roleId } : {}),
          ...(orderBy !== DEFAULT_ORDER_BY ? { orderBy } : {})
        });
        return `${baseUrl}?${params.toString()}`;
      };

      const pagination: PaginationMeta = {
        page, limit: rawLimit, totalRecord, totalPage,
        nextPage: page < totalPage,
        previousPage: page > 1,
        nextPageURL: page < totalPage ? buildUrl(page + 1) : "",
        previousPageURL: page > 1 ? buildUrl(page - 1) : "",
        filterColumn: filterColumn ?? "",
        searchTerm: searchTerm ?? "",
        orderBy,
      };

      return successResponse(correlationId, "Data found!", { records }, pagination);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // GET /api/users/:id — Get single user
  // ---------------------------------------------------------------------------
  static async getById(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string | undefined>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        return failedResponse(correlationId, "Data not found!", 400, "Invalid UUID format");
      }

      const user = await UserModel.findById(id);
      if (!user) return failedResponse(correlationId, "Data not found!", 400);

      return successResponse(correlationId, "Data found!", { record: user });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // PATCH /api/users/:id/status — Update status user
  // ---------------------------------------------------------------------------
  static async updateStatus(ctx: Context & { user?: JwtPayload }) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string | undefined>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        return failedResponse(correlationId, "Update data failed!", 400, "Invalid UUID format");
      }

      const body = ctx.body as Record<string, unknown> | undefined;
      const status = body?.status;
      if (status === undefined || (status !== 0 && status !== 1)) {
        return failedResponse(correlationId, "Update data failed!", 400, "Field 'status' must be 0 or 1");
      }

      const existingUser = await UserModel.findById(id);
      if (!existingUser) return failedResponse(correlationId, "Data not found!", 400);

      await UserModel.updateStatus(id, status as 0 | 1, ctx.user?.sub);
      return successResponse(correlationId, "Data has been updated", null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE /api/users/:id — Soft delete user
  // ---------------------------------------------------------------------------
  static async deleteUser(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const id = (ctx.params as Record<string, string | undefined>).id ?? "";
      if (!UUID_REGEX.test(id)) {
        return failedResponse(correlationId, "Delete data failed!", 400, "Invalid UUID format");
      }

      const existingUser = await UserModel.findById(id);
      if (!existingUser) return failedResponse(correlationId, "Data not found!", 400);

      await UserModel.deleteById(id);
      return successResponse(correlationId, "Data has been deleted", null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }
}
