import type { PurchaseRequestRecord, PurchaseRequestDetailRecord } from "./purchase-request.schema";
import type { CustomerDTO } from "../customer/customer.dto";
import type { WarehouseDTO } from "../warehouse/warehouse.dto";
import type { UserDTO } from "../user/user.dto";
import type { ItemDTO } from "../item/item.dto";

export type PRDetailDTO = Omit<PurchaseRequestDetailRecord, "deletedAt"> & {
  item?: ItemDTO;
};

export type PurchaseRequestDTO = Omit<PurchaseRequestRecord, "deletedAt"> & {
  details?: PRDetailDTO[];
  customer?: CustomerDTO | null;
  warehouse?: WarehouseDTO | null;
  requester?: UserDTO | null;
  approver?: UserDTO | null;
};

export function toPurchaseRequestDTO(record: any): PurchaseRequestDTO {
  const { deletedAt, details, customer, warehouse, requester, approver, ...dto } = record;
  
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
  
  if (customer) {
    const { deletedAt: cDelAt, ...cDto } = customer;
    dto.customer = cDto;
  }
  if (warehouse) {
    const { deletedAt: wDelAt, ...wDto } = warehouse;
    dto.warehouse = wDto;
  }
  if (requester) {
    const { deletedAt: rDelAt, password, ...rDto } = requester;
    dto.requester = rDto;
  }
  if (approver) {
    const { deletedAt: aDelAt, password, ...aDto } = approver;
    dto.approver = aDto;
  }

  return dto;
}
