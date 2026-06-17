import { Elysia } from "elysia";
import { failedResponse } from "../utils/response";
import { SessionModel } from "../models/SessionModel";

/**
 * Elysia scoped middleware that validates the Bearer session token.
 * On success, attaches `user: JwtPayload`, `sessionId: string`, and `correlationId: string` to context via derive.
 * On failure, returns a 401 response immediately.
 *
 * Usage: mount with .use(authMiddleware) before protected routes.
 * The `{ as: "scoped" }` option prevents the derive from leaking to
 * routes outside the scope where this middleware is applied.
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

      return {
        user: {
          sub: session.userId,
          email: session.user.email,
        },
        sessionId: session.id,
        correlationId,
      };
    } catch (err: any) {
      set.status = 401;
      if (err instanceof Response) {
        throw err;
      }
      throw new Response(
        JSON.stringify(failedResponse(correlationId, "Token invalid.", 401)),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  }
);


