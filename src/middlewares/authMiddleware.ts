import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import { failedResponse } from "../utils/response";
import type { JwtPayload } from "../types/JwtPayload";

/**
 * Elysia scoped middleware that validates the Bearer access token.
 * On success, attaches `user: JwtPayload` to context via derive.
 * On failure, returns a 401 failedResponse immediately.
 *
 * Usage: mount with .use(authMiddleware) before protected routes.
 * The `{ as: "scoped" }` option prevents the derive from leaking to
 * routes outside the scope where this middleware is applied.
 */
export const authMiddleware = new Elysia({ name: "authMiddleware" }).derive(
  { as: "scoped" },
  ({ headers }) => {
    const correlationId =
      (headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    const authorization = headers["authorization"];

    if (!authorization || !authorization.startsWith("Bearer ")) {
      // Throwing inside derive causes Elysia to respond with an error —
      // we wrap it in a way the onError handler can intercept, but since
      // we want a standard response shape we return early via a thrown object.
      throw failedResponse(correlationId, "Token invalid.", 401);
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      throw failedResponse(correlationId, "Token invalid.", 401);
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as JwtPayload;

      return { user: decoded, correlationId };
    } catch {
      throw failedResponse(correlationId, "Token invalid.", 401);
    }
  }
);
