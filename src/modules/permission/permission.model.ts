import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../core/db";
import { roleMenuPermissions } from "./permission.schema";
import { roles } from "../role/role.schema";
import { menus } from "../menu/menu.schema";
import type { PermissionMatrixRow } from "./permission.dto";
import type { UpdatePermissionInput } from "./permission.validation";

export class PermissionModel {
  /**
   * Mengambil matriks lengkap semua permission (semua role x semua menu).
   * Digunakan untuk halaman UI Role Menu Management.
   */
  static async getPermissionMatrix(): Promise<PermissionMatrixRow[]> {
    const result = await db
      .select({
        id: roleMenuPermissions.id,
        roleId: roleMenuPermissions.roleId,
        roleName: roles.name,
        menuId: roleMenuPermissions.menuId,
        menuName: menus.name,
        menuCode: menus.code,
        canView: roleMenuPermissions.canView,
        canCreate: roleMenuPermissions.canCreate,
        canUpdate: roleMenuPermissions.canUpdate,
        canDelete: roleMenuPermissions.canDelete,
      })
      .from(roleMenuPermissions)
      .innerJoin(roles, eq(roleMenuPermissions.roleId, roles.id))
      .innerJoin(menus, eq(roleMenuPermissions.menuId, menus.id))
      .where(isNull(roleMenuPermissions.deletedAt))
      .orderBy(roles.name, menus.name);

    return result;
  }

  /**
   * Mengambil permission berdasarkan role ID.
   * Digunakan oleh permissionGuard middleware untuk validasi akses.
   */
  static async getByRoleId(roleId: string) {
    return db
      .select({
        menuCode: menus.code,
        canView: roleMenuPermissions.canView,
        canCreate: roleMenuPermissions.canCreate,
        canUpdate: roleMenuPermissions.canUpdate,
        canDelete: roleMenuPermissions.canDelete,
      })
      .from(roleMenuPermissions)
      .innerJoin(menus, eq(roleMenuPermissions.menuId, menus.id))
      .where(
        and(
          eq(roleMenuPermissions.roleId, roleId),
          isNull(roleMenuPermissions.deletedAt)
        )
      );
  }

  /**
   * Upsert permission — insert jika belum ada, update jika sudah ada.
   * Digunakan saat Superadmin mengubah hak akses.
   */
  static async upsertPermission(
    payload: UpdatePermissionInput,
    updatedBy?: string
  ): Promise<void> {
    const existing = await db
      .select({ id: roleMenuPermissions.id })
      .from(roleMenuPermissions)
      .where(
        and(
          eq(roleMenuPermissions.roleId, payload.roleId),
          eq(roleMenuPermissions.menuId, payload.menuId),
          isNull(roleMenuPermissions.deletedAt)
        )
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(roleMenuPermissions)
        .set({
          canView: payload.canView,
          canCreate: payload.canCreate,
          canUpdate: payload.canUpdate,
          canDelete: payload.canDelete,
          updatedAt: new Date(),
          updatedBy,
        })
        .where(eq(roleMenuPermissions.id, existing[0].id));
    } else {
      await db.insert(roleMenuPermissions).values({
        roleId: payload.roleId,
        menuId: payload.menuId,
        canView: payload.canView,
        canCreate: payload.canCreate,
        canUpdate: payload.canUpdate,
        canDelete: payload.canDelete,
        createdBy: updatedBy,
      });
    }
  }

  /**
   * Bulk upsert permissions — untuk update banyak permission sekaligus.
   */
  static async bulkUpsert(
    permissions: UpdatePermissionInput[],
    updatedBy?: string
  ): Promise<void> {
    await Promise.all(
      permissions.map((perm) => PermissionModel.upsertPermission(perm, updatedBy))
    );
  }

  /**
   * Cek apakah role memiliki akses tertentu ke menu tertentu.
   * Digunakan secara internal oleh permissionGuard.
   */
  static async checkAccess(
    roleId: string,
    menuCode: string,
    action: "canView" | "canCreate" | "canUpdate" | "canDelete"
  ): Promise<boolean> {
    const result = await db
      .select({
        canView: roleMenuPermissions.canView,
        canCreate: roleMenuPermissions.canCreate,
        canUpdate: roleMenuPermissions.canUpdate,
        canDelete: roleMenuPermissions.canDelete,
      })
      .from(roleMenuPermissions)
      .innerJoin(menus, eq(roleMenuPermissions.menuId, menus.id))
      .where(
        and(
          eq(roleMenuPermissions.roleId, roleId),
          eq(menus.code, menuCode),
          isNull(roleMenuPermissions.deletedAt)
        )
      )
      .limit(1);

    const perm = result[0];
    if (!perm) return false;
    return perm[action] === true;
  }
}
