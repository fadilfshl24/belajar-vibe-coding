import type { VendorRecord } from "./vendor.schema";

export type VendorDTO = Omit<VendorRecord, "deletedAt">;

export function toVendorDTO(record: VendorRecord): VendorDTO {
  const { deletedAt, ...dto } = record;
  return dto;
}
