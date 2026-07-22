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
import { itemPlatformSkuRoutes } from "./modules/item-platform-sku";
import { transactionRoutes } from "./modules/transaction/transaction.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { regionRoutes } from "./modules/region/region.routes";
import { customerRoutes } from "./modules/customer";
import { vendorRoutes } from "./modules/vendor";
import { platformRoutes } from "./modules/platform";
import { purchaseRequestRoutes } from "./modules/purchase-request";
import { purchaseOrderRoutes } from "./modules/purchase-order";
import { userWarehouseMappingRoutes } from "./modules/user-warehouse-mapping";
import { warehouseRegionRoutes } from "./modules/warehouse/warehouse.routes";
import { uploadRoutes } from "./modules/upload/upload.routes";
import { quotationPlanRoutes } from "./modules/quotation-plan/quotation-plan.routes";
import { reportRoutes } from "./modules/report/report.routes";
import { approvalStepRoutes } from "./modules/approval-step";
import { goodsReceiptRoutes } from "./modules/goods-receipt";
import { qualityControlRoutes } from "./modules/quality-control";
import { scrapRoutes } from "./modules/scrap/scrap.routes";
import { assemblyOrderRoutes } from "./modules/assembly-order";
import { notificationRoutes, notificationWsRoutes } from "./modules/notification/notification.routes";

import { stockOrderRoutes } from "./modules/stock-order/stock-order.routes";
import { staticPlugin } from "@elysiajs/static";
/**
 * App Factory
 *
 * Merakit semua modul menjadi satu aplikasi Elysia.
 * Untuk menambahkan modul baru, cukup import routesnya di sini
 * dan panggil .use() — tidak perlu menyentuh file lain.
 */
export const app = new Elysia()
  .onRequest(({ request, set }) => {
    const origin = request.headers.get("origin");
    if (origin) {
      set.headers["Access-Control-Allow-Origin"] = origin;
    } else {
      set.headers["Access-Control-Allow-Origin"] = "*";
    }
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
  .use(
    staticPlugin({
      assets: "public",
      prefix: "/public",
    })
  )
  .use(authRoutes)
  .use(userRoutes)
  .use(roleRoutes)
  .use(menuRoutes)
  .use(permissionRoutes)
  .use(activityLogRoutes)
  .use(approvalStepRoutes)
  // Master Data Modules
  .use(warehouseRoutes)
  .use(categoryRoutes)
  .use(uomRoutes)
  .use(itemRoutes)
  .use(itemPlatformSkuRoutes)
  .use(customerRoutes)
  .use(vendorRoutes)
  .use(platformRoutes)
  // Transaction & Inventory Modules
  .use(inventoryRoutes)
  .use(dashboardRoutes)
  .use(regionRoutes)
  .use(purchaseRequestRoutes)
  .use(purchaseOrderRoutes)
  .use(quotationPlanRoutes)
  .use(goodsReceiptRoutes)
  .use(qualityControlRoutes)
  .use(scrapRoutes)
  .use(assemblyOrderRoutes)
  .use(reportRoutes)
  .use(transactionRoutes)
  .use(stockOrderRoutes)
  .use(userWarehouseMappingRoutes)
  .use(warehouseRegionRoutes)
  .use(uploadRoutes)
  // Notification Module (REST + WebSocket)
  .use(notificationRoutes)
  .use(notificationWsRoutes)
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? "1.0.0",
  }));
