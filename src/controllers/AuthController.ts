import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Context } from "elysia";
import { failedResponse, successResponse } from "../utils/response";
import { validateLoginInput, validateRefreshTokenInput } from "../validations/authValidation";
import { UserModel } from "../models/UserModel";
import type { JwtPayload } from "../types/JwtPayload";

export class AuthController {
  // ---------------------------------------------------------------------------
  // POST /login
  // ---------------------------------------------------------------------------
  static async login(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    try {
      // 1. Validate request body
      const validation = validateLoginInput(ctx.body);
      if (!validation.valid) {
        return failedResponse(
          correlationId,
          "Login failed!",
          400,
          validation.error ?? "Input data not found or invalid!"
        );
      }

      const { email, password } = ctx.body as { email: string; password: string };

      // 2. Look up user — use identical error messages for "not found" vs
      //    "wrong password" to prevent user enumeration attacks.
      const user = await UserModel.findByEmail(email.toLowerCase().trim());
      if (!user) {
        return failedResponse(
          correlationId,
          "Data not found!",
          400,
          "Email or password is incorrect"
        );
      }

      // 3. Check account is active
      if (user.status !== 1) {
        return failedResponse(
          correlationId,
          "Login failed!",
          400,
          "Your account is inactive"
        );
      }

      // 4. Verify password — never log the plaintext or hash
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return failedResponse(
          correlationId,
          "Data not found!",
          400,
          "Email or password is incorrect"
        );
      }

      // 5. Issue tokens
      const payload: JwtPayload = { sub: user.id, email: user.email };
      const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";

      const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn,
      } as jwt.SignOptions);

      const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
      } as jwt.SignOptions);

      return successResponse(correlationId, "Data found!", {
        record: {
          accessToken,
          refreshToken,
          tokenType: "Bearer",
          expiresIn,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // POST /refresh-token
  // ---------------------------------------------------------------------------
  static async refreshToken(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    try {
      // 1. Validate body
      const validation = validateRefreshTokenInput(ctx.body);
      if (!validation.valid) {
        return failedResponse(
          correlationId,
          "Refresh token failed!",
          400,
          validation.error ?? "Input data not found or invalid!"
        );
      }

      const { refreshToken } = ctx.body as { refreshToken: string };

      // 2. Verify refresh token using the dedicated secret
      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET!
        ) as JwtPayload;
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : "Invalid token";
        return failedResponse(correlationId, "Token invalid.", 401, detail);
      }

      // 3. Confirm user still exists and is active
      const user = await UserModel.findById(decoded.sub);
      if (!user || user.status !== 1) {
        return failedResponse(correlationId, "Token invalid.", 401);
      }

      // 4. Issue a new access token — refresh token is NOT rotated here
      const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
      const newAccessToken = jwt.sign(
        { sub: decoded.sub, email: decoded.email } as JwtPayload,
        process.env.JWT_SECRET!,
        { expiresIn } as jwt.SignOptions
      );

      return successResponse(correlationId, "Data found!", {
        record: {
          accessToken: newAccessToken,
          tokenType: "Bearer",
          expiresIn,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return failedResponse(correlationId, "Internal server error", 500, message);
    }
  }

  // ---------------------------------------------------------------------------
  // POST /logout  (protected — requires valid Bearer access token)
  // ---------------------------------------------------------------------------
  static async logout(ctx: Context & { user?: JwtPayload; correlationId?: string }) {
    // correlationId and user are injected by authMiddleware via derive
    const correlationId =
      ctx.correlationId ??
      (ctx.headers["x-correlation-id"] as string | undefined) ??
      crypto.randomUUID();

    // Stateless logout — token invalidation requires a Redis blacklist (future work).
    // Client is responsible for discarding the token from its storage.
    return successResponse(correlationId, "Data has been deleted", null);
  }
}
