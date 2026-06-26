import { Elysia } from "elysia";
import { VendorController } from "./vendor.controller";

export const vendorRoutes = new Elysia().use(VendorController.routes);
