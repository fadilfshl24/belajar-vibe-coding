import bcrypt from "bcryptjs";
import type { Context } from "elysia";
import { failedResponse, successResponse } from "../utils/response";
import { validateRegisterInput } from "../validations/userValidation";
import { UserModel } from "../models/UserModel";

const BCRYPT_SALT_ROUNDS = 10;

export class UserController {
  static async register(ctx: Context) {
    // 1. Extract correlationId from header or generate a new one
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    try {
      // 2. Validate request body
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

      // 3. Check for duplicate email
      const existingUser = await UserModel.findByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return failedResponse(
          correlationId,
          "Create data failed!",
          400,
          "Email already registered"
        );
      }

      // 4. Hash password — never store plain text
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      // 5. Persist to DB
      await UserModel.createUser({ name, email, password: hashedPassword });

      // 6. Return success — do NOT return the created user record (contains password hash)
      return successResponse(correlationId, "Data has been created", null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(
        correlationId,
        "Internal server error",
        500,
        message
      );
    }
  }
}
