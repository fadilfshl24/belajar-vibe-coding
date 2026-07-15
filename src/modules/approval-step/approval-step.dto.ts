export interface CreateApprovalStepInput {
  documentType: "PR" | "QP" | "PO" | "QC" | "SCRAP";
  stage: number;
  roleId: string;
  isActive?: boolean;
}

export interface UpdateApprovalStepInput extends Partial<CreateApprovalStepInput> {}
