import { Elysia } from "elysia";
import { AuthController } from "./auth.controller";
import { authMiddleware } from "./auth.middleware";

/**
 * Auth Routes
 *
 * Public:
 * - POST /login
 * - POST /refresh-token
 * - GET  /oauth/:provider
 * - GET  /oauth/:provider/callback
 *
 * Protected (memerlukan Bearer token):
 * - POST /logout
 */
export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .post("/login", AuthController.login)
  .post("/refresh-token", AuthController.refreshToken)
  .get("/oauth/:provider", AuthController.oauthRedirect)
  .get("/oauth/:provider/callback", AuthController.oauthCallback)
  .use(authMiddleware)
  .post("/logout", AuthController.logout);
