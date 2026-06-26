import { Elysia } from "elysia";
import { authMiddleware } from "../../modules/auth/auth.middleware";
import { failedResponse } from "../utils/response";

export const requirePermission = (permission: string) => {
  return new Elysia({ name: `requirePermission:${permission}` })
    .use(authMiddleware)
    .onBeforeHandle(async ({ user, set, correlationId }) => {
      // TODO: Implement actual permission checks based on roles here
      // The authMiddleware already guarantees that the user is authenticated.
      if (!user) {
        set.status = 401;
        throw new Response(
          JSON.stringify(failedResponse(correlationId, "Unauthorized", 401)),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    });
};
