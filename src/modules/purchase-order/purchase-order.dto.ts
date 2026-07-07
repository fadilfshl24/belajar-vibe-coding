import type { PurchaseOrderRecord, PurchaseOrderDetailRecord, PurchaseOrderApprovalRecord, PurchaseOrderRequestRecord } from "./purchase-order.schema";
import type { VendorDTO } from "../vendor/vendor.dto";
import type { WarehouseDTO } from "../warehouse/warehouse.dto";
import type { PurchaseRequestDTO } from "../purchase-request/purchase-request.dto";
import type { ItemDTO } from "../item/item.dto";
import type { UserDTO } from "../user/user.dto";

export type PODetailDTO = Omit<PurchaseOrderDetailRecord, "deletedAt"> & {
  item?: ItemDTO;
};

export type POApprovalDTO = Omit<PurchaseOrderApprovalRecord, "deletedAt"> & {
  approver?: UserDTO | null;
};

export type PORequestDTO = Omit<PurchaseOrderRequestRecord, "deletedAt"> & {
  purchaseRequest?: PurchaseRequestDTO | null;
};

export type PurchaseOrderDTO = Omit<PurchaseOrderRecord, "deletedAt"> & {
  details?: PODetailDTO[];
  vendor?: VendorDTO | null;
  warehouse?: WarehouseDTO | null;
  purchaseRequest?: PurchaseRequestDTO | null; // deprecated single PR
  purchaseRequests?: PORequestDTO[];           // new: multi-PR list
  approvals?: POApprovalDTO[];
};

export function toPurchaseOrderDTO(record: any): PurchaseOrderDTO {
  const { deletedAt, details, vendor, warehouse, purchaseRequest, purchaseRequests, approvals, approvedByUser, ...dto } = record;

  if (details) {
    dto.details = details.map((d: any) => {
      const { deletedAt: dDelAt, item, ...dDto } = d;
      if (item) {
        const { deletedAt: iDelAt, ...iDto } = item;
        dDto.item = iDto;
      }
      return dDto;
    });
  }

  if (vendor) {
    const { deletedAt: vDelAt, ...vDto } = vendor;
    dto.vendor = vDto;
  }
  if (warehouse) {
    const { deletedAt: wDelAt, ...wDto } = warehouse;
    dto.warehouse = wDto;
  }
  if (purchaseRequest) {
    const { deletedAt: prDelAt, details: prDetails, ...prDto } = purchaseRequest;
    dto.purchaseRequest = prDto;
  }
  if (purchaseRequests) {
    dto.purchaseRequests = purchaseRequests.map((por: any) => {
      const { deletedAt: porDelAt, purchaseRequest: pr, ...porDto } = por;
      if (pr) {
        const { deletedAt: prDelAt, details: prDetails, ...prDto } = pr;
        porDto.purchaseRequest = prDto;
      }
      return porDto;
    });
  }
  if (approvals) {
    dto.approvals = approvals.map((a: any) => {
      const { deletedAt: aDelAt, approver, ...aDto } = a;
      if (approver) {
        const { deletedAt: apvDelAt, password, ...apvDto } = approver;
        aDto.approver = apvDto;
      }
      return aDto;
    });
  }

  return dto;
}

