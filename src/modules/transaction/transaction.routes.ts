import { Elysia } from "elysia";
import { TransactionController } from "./transaction.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { permissionGuard } from "../permission/permission.middleware";

export const transactionRoutes = new Elysia({ prefix: "/api/transactions" })
  .use(authMiddleware)
  .get("/", TransactionController.getAll, {
    beforeHandle: [permissionGuard("transaksi", "canView")],
  })
  .get("/:id", TransactionController.getById, {
    beforeHandle: [permissionGuard("transaksi", "canView")],
  })
  .post("/", TransactionController.create, {
    beforeHandle: [permissionGuard("transaksi", "canCreate")],
  })
  .post("/:id/complete", TransactionController.complete, {
    beforeHandle: [permissionGuard("transaksi", "canUpdate")],
  })
  .post("/:id/cancel-request", TransactionController.cancelRequest, {
    beforeHandle: [permissionGuard("transaksi", "canUpdate")],
  })
  .post("/:id/cancel-approve", TransactionController.cancelApprove, {
    beforeHandle: [permissionGuard("transaksi", "canUpdate")], // Or specifically check for warehouse head in controller
  });
