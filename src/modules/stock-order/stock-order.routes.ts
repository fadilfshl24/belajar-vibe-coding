import { Elysia } from "elysia";
import { StockOrderController } from "./stock-order.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const stockOrderRoutes = new Elysia({ prefix: "/stock-orders" })
  .use(authMiddleware)

  // ── Import ─────────────────────────────────────────────────────────────────
  .post("/import", StockOrderController.importExcel)

  // ── List & Detail ──────────────────────────────────────────────────────────
  .get("/", StockOrderController.list)
  .get("/by-tracking/:trackingId", StockOrderController.getByTrackingId)  // legacy — tetap sejajar

  // ── Scan Endpoints (Baru) ──────────────────────────────────────────────────
  // Endpoint ini melakukan validasi warehouse (via JWT) dan status sebelum memberi data
  .get("/scan/outbound/:trackingId", StockOrderController.scanOutbound)
  .get("/scan/inbound/:trackingId", StockOrderController.scanInbound)

  // ── Actions ────────────────────────────────────────────────────────────────
  .post("/:id/pack", StockOrderController.packOrder)                       // legacy — simple pack
  .post("/:id/pack-with-mapping", StockOrderController.packWithMapping)    // baru — dengan item mapping
  .post("/:id/return", StockOrderController.returnOrder)                   // legacy — return semua item
  .post("/:id/process-return", StockOrderController.processReturn);        // baru — parsial return + foto bukti
