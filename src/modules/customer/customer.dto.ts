import type { CustomerRecord } from "./customer.schema";

export type CustomerDTO = Omit<CustomerRecord, "deletedAt">;

export function toCustomerDTO(record: CustomerRecord): CustomerDTO {
  const { deletedAt, ...dto } = record;
  return dto;
}
