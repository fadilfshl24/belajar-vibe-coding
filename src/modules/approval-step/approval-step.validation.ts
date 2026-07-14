import { z } from "zod";

const baseApprovalStepSchema = z.object({
  documentType: z.enum(["PR", "QP", "PO", "QC"]),
  stage: z.number({ message: "Stage is required" }).min(0),
  roleId: z.string({ message: "Role ID is required" }).uuid("Invalid Role ID format"),
  isActive: z.boolean().optional(),
});

export function parseCreateApprovalStepInput(data: unknown) {
  return baseApprovalStepSchema.safeParse(data);
}

export function parseUpdateApprovalStepInput(data: unknown) {
  return baseApprovalStepSchema.partial().safeParse(data);
}
