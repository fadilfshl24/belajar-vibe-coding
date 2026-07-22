import Elysia from "elysia";
import { ApprovalStepController } from "./approval-step.controller";
import { authMiddleware } from "../auth";
import { permissionGuard } from "../permission/permission.middleware";

export const approvalStepRoutes = new Elysia({ prefix: "/api/approval-steps" })
  .use(authMiddleware)
  .get("/", ApprovalStepController.getAll, {
    beforeHandle: [permissionGuard("approval_step", "canView")],
  })
  .get("/approvers", ApprovalStepController.getApprovers)
  .get("/:id", ApprovalStepController.getById, {
    beforeHandle: [permissionGuard("approval_step", "canView")],
  })
  .post("/", ApprovalStepController.create, {
    beforeHandle: [permissionGuard("approval_step", "canCreate")],
  })
  .put("/:id", ApprovalStepController.update, {
    beforeHandle: [permissionGuard("approval_step", "canUpdate")],
  })
  .delete("/:id", ApprovalStepController.remove, {
    beforeHandle: [permissionGuard("approval_step", "canDelete")],
  });
