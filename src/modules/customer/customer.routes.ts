import { Elysia } from "elysia";
import { CustomerController } from "./customer.controller";

export const customerRoutes = new Elysia().use(CustomerController.routes);
