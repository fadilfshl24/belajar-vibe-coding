import { Elysia } from "elysia";
import { authRoutes } from "./modules/auth";
import { userRoutes } from "./modules/user";
import { roleRoutes } from "./modules/role";
import { menuRoutes } from "./modules/menu";
import { permissionRoutes } from "./modules/permission";
import { activityLogRoutes } from "./modules/activity-log";
import { warehouseRoutes } from "./modules/warehouse";
import { categoryRoutes } from "./modules/category";
import { uomRoutes } from "./modules/uom";
import { itemRoutes } from "./modules/item";

/**
 * App Factory
 *
 * Merakit semua modul menjadi satu aplikasi Elysia.
 * Untuk menambahkan modul baru, cukup import routesnya di sini
 * dan panggil .use() — tidak perlu menyentuh file lain.
 */
export const app = new Elysia()
  .onRequest(({ request, set }) => {
    set.headers["Access-Control-Allow-Origin"] = "http://localhost:5173";
    set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
    set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    set.headers["Access-Control-Allow-Credentials"] = "true";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: set.headers as Record<string, string>,
      });
    }
  })
  .use(authRoutes)
  .use(userRoutes)
  .use(roleRoutes)
  .use(menuRoutes)
  .use(permissionRoutes)
  .use(activityLogRoutes)
  // Master Data Modules
  .use(warehouseRoutes)
  .use(categoryRoutes)
  .use(uomRoutes)
  .use(itemRoutes)
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? "1.0.0",
  }));
