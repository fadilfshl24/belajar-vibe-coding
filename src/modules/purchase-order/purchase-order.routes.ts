import { Elysia } from "elysia";
import { PurchaseOrderController } from "./purchase-order.controller";

export const purchaseOrderRoutes = new Elysia().use(PurchaseOrderController.routes);
