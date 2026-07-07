import type { RoleRecord } from "./role.schema";

export interface RoleDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toRoleDTO(record: RoleRecord): RoleDTO {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}
