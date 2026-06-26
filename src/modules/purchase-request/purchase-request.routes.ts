import { Elysia } from "elysia";
import { PurchaseRequestController } from "./purchase-request.controller";

export const purchaseRequestRoutes = new Elysia().use(PurchaseRequestController.routes);
