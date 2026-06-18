import type { MenuRecord } from "./menu.schema";

export interface MenuDTO {
  id: string;
  name: string;
  code: string;
  path: string;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toMenuDTO(record: MenuRecord): MenuDTO {
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    path: record.path,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}
