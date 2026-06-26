import type { PurchaseOrderRecord, PurchaseOrderDetailRecord } from "./purchase-order.schema";
import type { VendorDTO } from "../vendor/vendor.dto";
import type { WarehouseDTO } from "../warehouse/warehouse.dto";
import type { PurchaseRequestDTO } from "../purchase-request/purchase-request.dto";
import type { ItemDTO } from "../item/item.dto";

export type PODetailDTO = Omit<PurchaseOrderDetailRecord, "deletedAt"> & {
  item?: ItemDTO;
};

export type PurchaseOrderDTO = Omit<PurchaseOrderRecord, "deletedAt"> & {
  details?: PODetailDTO[];
  vendor?: VendorDTO | null;
  warehouse?: WarehouseDTO | null;
  purchaseRequest?: PurchaseRequestDTO | null;
};

export function toPurchaseOrderDTO(record: any): PurchaseOrderDTO {
  const { deletedAt, details, vendor, warehouse, purchaseRequest, ...dto } = record;
  
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
    const { deletedAt: prDelAt, details: prDetails, ...prDto } = purchaseRequest; // Avoid deeply nesting too much PR details if not needed
    dto.purchaseRequest = prDto;
  }

  return dto;
}
