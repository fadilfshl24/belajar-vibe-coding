import { Elysia } from "elysia";
import { failedResponse } from "../../core/utils/response";
import { SessionModel } from "./auth.model";
import type { JwtPayload } from "../../core/types/JwtPayload";

/**
 * authMiddleware
 *
 * Elysia scoped middleware yang memvalidasi Bearer session token.
 *
 * Ketika berhasil, middleware ini meng-inject ke context:
 * - `user`          : { sub: userId, email }
 * - `sessionId`     : string (session UUID)
 * - `correlationId` : string (dari header atau auto-generate)
 *
 * Ketika gagal, langsung mengembalikan HTTP 401.
 *
 * Penggunaan: .use(authMiddleware) sebelum route yang ingin diproteksi.
 * Opsi `{ as: "scoped" }` mencegah derive bocor ke luar scope.
 */
export const authMiddleware = new Elysia({ name: "authMiddleware" }).derive(
  { as: "scoped" },
  async ({ headers, set }) => {
    const correlationId =
      (headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    const authorization = headers["authorization"];

    if (!authorization || !authorization.startsWith("Bearer ")) {
      set.status = 401;
      throw new Response(
        JSON.stringify(failedResponse(correlationId, "Token invalid.", 401)),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      set.status = 401;
      throw new Response(
        JSON.stringify(failedResponse(correlationId, "Token invalid.", 401)),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const session = await SessionModel.validateSession(token);
      if (!session) {
        set.status = 401;
        throw new Response(
          JSON.stringify(failedResponse(correlationId, "Token invalid.", 401)),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const user: JwtPayload = {
        sub: session.userId,
        email: session.user.email,
      };

      return { user, sessionId: session.id, correlationId };
    } catch (err) {
      set.status = 401;
      if (err instanceof Response) throw err;
      throw new Response(
        JSON.stringify(failedResponse(correlationId, "Token invalid.", 401)),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  }
);
