export interface ScrapDetailDTO {
  id: string;
  scrapId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ScrapDTO {
  id: string;
  code: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  type: string; // "IN" | "OUT"
  reasonCategory: string; // "DAMAGED" | "LOST" | "QC_REJECT" | "CUSTOMER_REFUND" | "OTHER"
  notes: string | null;
  status: number; // 0=Draft, 1=Pending Approval, 2=Approved, 3=Rejected
  currentApprovalStage: number;
  createdBy: string | null;
  createdByName?: string;
  createdAt: string;
  updatedAt: string | null;
  details?: ScrapDetailDTO[];
}
