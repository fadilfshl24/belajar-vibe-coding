import { Elysia } from "elysia";
import { AssemblyOrderController } from "./assembly-order.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const assemblyOrderRoutes = new Elysia({ prefix: "/api/assembly-orders" })
  .use(authMiddleware)
  .get("/", AssemblyOrderController.getAll)
  .get("/:id", AssemblyOrderController.getById)
  .post("/", AssemblyOrderController.create)
  .post("/:id/approve", AssemblyOrderController.approve)
  .post("/:id/reject", AssemblyOrderController.reject);
