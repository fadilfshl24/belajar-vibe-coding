import type { UomRecord } from "./uom.schema";

export interface UomDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toUomDTO(record: UomRecord): UomDTO {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description ?? null,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}
