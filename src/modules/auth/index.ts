/**
 * Public API Module: auth
 *
 * Ekspor yang diizinkan untuk digunakan oleh modul lain:
 * - authRoutes    : Elysia route handler (mount di app.ts)
 * - authMiddleware: Middleware untuk proteksi route
 */
export { authRoutes } from "./auth.routes";
export { authMiddleware } from "./auth.middleware";
