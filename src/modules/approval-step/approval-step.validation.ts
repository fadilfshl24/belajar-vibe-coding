import { z } from "zod";

const baseApprovalStepSchema = z.object({
  documentType: z.enum(["PR", "QP", "PO"], { required_error: "Document Type is required" }),
  stage: z.number({ required_error: "Stage is required" }).min(0),
  roleId: z.string({ required_error: "Role ID is required" }).uuid("Invalid Role ID format"),
  isActive: z.boolean().optional(),
});

export function parseCreateApprovalStepInput(data: unknown) {
  return baseApprovalStepSchema.safeParse(data);
}

export function parseUpdateApprovalStepInput(data: unknown) {
  return baseApprovalStepSchema.partial().safeParse(data);
}
