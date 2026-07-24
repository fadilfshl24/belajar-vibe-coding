import { Elysia } from "elysia";
import { QuotationPlanController } from "./quotation-plan.controller";
import { authMiddleware } from "../auth";
import { permissionGuard } from "../permission";

export const quotationPlanRoutes = new Elysia({ prefix: "/api/quotation-plans" })
  .use(authMiddleware)
  .get(
    "/",
    QuotationPlanController.getAll,
    {
      beforeHandle: [permissionGuard("quotation_plan", "canView")]
    }
  )
  .post(
    "/",
    QuotationPlanController.create,
    {
      beforeHandle: [permissionGuard("quotation_plan", "canCreate")]
    }
  )
  .get(
    "/:id",
    QuotationPlanController.getById,
    {
      beforeHandle: [permissionGuard("quotation_plan", "canView")]
    }
  )
  .post(
    "/:id/approve",
    QuotationPlanController.approve,
    {
      beforeHandle: [permissionGuard("quotation_plan", "canUpdate")]
    }
  )
  .post(
    "/:id/cancel",
    QuotationPlanController.cancel,
    {
      beforeHandle: [permissionGuard("quotation_plan", "canUpdate")]
    }
  );
