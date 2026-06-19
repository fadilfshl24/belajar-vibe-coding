import type { MenuRecord } from "./menu.schema";

export interface MenuDTO {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  path: string;
  sortOrder: number;
  icon: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toMenuDTO(record: MenuRecord): MenuDTO {
  return {
    id: record.id,
    parentId: record.parentId,
    name: record.name,
    code: record.code,
    path: record.path,
    sortOrder: record.sortOrder,
    icon: record.icon,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}
