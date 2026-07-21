import type { QuotationPlanRecord, QuotationPlanDetailRecord } from "./quotation-plan.schema";
import type { DocumentApprovalRecord } from "../approval/document-approval.schema";
import type { PurchaseRequestDTO } from "../purchase-request/purchase-request.dto";
import type { WarehouseDTO } from "../warehouse/warehouse.dto";
import type { UserDTO } from "../user/user.dto";
import type { ItemDTO } from "../item/item.dto";
import type { VendorDTO } from "../vendor/vendor.dto";

export type QuotationPlanDetailDTO = Omit<QuotationPlanDetailRecord, "deletedAt"> & {
  item?: ItemDTO;
  vendor?: VendorDTO;
};

export type QuotationPlanApprovalDTO = Omit<DocumentApprovalRecord, "deletedAt"> & {
  approver?: UserDTO | null;
};

export type QuotationPlanDTO = Omit<QuotationPlanRecord, "deletedAt"> & {
  details?: QuotationPlanDetailDTO[];
  purchaseRequests?: (PurchaseRequestDTO & { _pivot?: any })[];
  warehouse?: WarehouseDTO | null;
  requester?: UserDTO | null;
  approvals?: QuotationPlanApprovalDTO[];
};

export function toQuotationPlanDTO(record: any): QuotationPlanDTO {
  const { deletedAt, details, purchaseRequest, warehouse, requester, approvals, ...dto } = record;
  
  if (details) {
    dto.details = details.map((d: any) => {
      const { deletedAt: dDelAt, item, vendor, ...dDto } = d;
      if (item) {
        const { deletedAt: iDelAt, ...iDto } = item;
        dDto.item = iDto;
      }
      if (vendor) {
        const { deletedAt: vDelAt, ...vDto } = vendor;
        dDto.vendor = vDto;
      }
      return dDto;
    });
  }
  
  if (record.purchaseRequests) {
    dto.purchaseRequests = record.purchaseRequests.map((prPivot: any) => {
      const pr = prPivot.purchaseRequest || prPivot;
      const { deletedAt: prDelAt, ...prDto } = pr;
      return prDto;
    });
  }
  if (warehouse) {
    const { deletedAt: wDelAt, ...wDto } = warehouse;
    dto.warehouse = wDto;
  }
  if (requester) {
    const { deletedAt: rDelAt, password, ...rDto } = requester;
    dto.requester = rDto;
  }
  if (approvals) {
    dto.approvals = approvals.map((a: any) => {
      const { deletedAt: apDelAt, approver: apVal, ...aDto } = a;
      if (apVal) {
        const { deletedAt: apvDelAt, password, ...apvDto } = apVal;
        aDto.approver = apvDto;
      }
      return aDto;
    });
  }
  
  return dto;
}
