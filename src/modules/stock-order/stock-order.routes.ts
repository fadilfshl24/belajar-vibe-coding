import { Elysia } from "elysia";
import { StockOrderController } from "./stock-order.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const stockOrderRoutes = new Elysia({ prefix: "/stock-orders" })
  .use(authMiddleware)
  .post("/import", StockOrderController.importExcel) // Will need multipart plugin handled at app level or here
  .get("/", StockOrderController.list)
  .get("/by-tracking/:trackingId", StockOrderController.getByTrackingId)
  .post("/:id/pack", StockOrderController.packOrder)
  .post("/:id/return", StockOrderController.returnOrder);
