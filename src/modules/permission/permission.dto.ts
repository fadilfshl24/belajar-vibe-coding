import type { RoleMenuPermissionRecord } from "./permission.schema";

export interface PermissionDTO {
  id: string;
  roleId: string;
  menuId: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface PermissionMatrixRow {
  roleId: string;
  roleName: string;
  menuId: string;
  menuName: string;
  menuCode: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function toPermissionDTO(record: RoleMenuPermissionRecord): PermissionDTO {
  return {
    id: record.id,
    roleId: record.roleId,
    menuId: record.menuId,
    canView: record.canView,
    canCreate: record.canCreate,
    canUpdate: record.canUpdate,
    canDelete: record.canDelete,
  };
}
