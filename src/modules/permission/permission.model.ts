import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "../../core/db";
import { roleMenuPermissions } from "./permission.schema";
import { roles, userWarehouseRoles } from "../role/role.schema";
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
        roleName: roles.code,
        menuId: roleMenuPermissions.menuId,
        menuName: menus.name,
        menuCode: menus.code,
        canView: roleMenuPermissions.canView,
        canCreate: roleMenuPermissions.canCreate,
        canUpdate: roleMenuPermissions.canUpdate,
        canDelete: roleMenuPermissions.canDelete,
        canAccessApi: roleMenuPermissions.canAccessApi,
      })
      .from(roleMenuPermissions)
      .innerJoin(roles, eq(roleMenuPermissions.roleId, roles.id))
      .innerJoin(menus, eq(roleMenuPermissions.menuId, menus.id))
      .where(isNull(roleMenuPermissions.deletedAt))
      .orderBy(roles.code, menus.name);

    return result;
  }

  /**
   * Mengambil matriks permission untuk satu role tertentu secara lengkap.
   * Digunakan untuk halaman UI Role Menu Management untuk spesifik role.
   */
  static async getMatrixByRoleId(roleId: string): Promise<PermissionMatrixRow[]> {
    const result = await db
      .select({
        id: roleMenuPermissions.id,
        roleId: roleMenuPermissions.roleId,
        roleName: roles.code,
        menuId: roleMenuPermissions.menuId,
        menuName: menus.name,
        menuCode: menus.code,
        canView: roleMenuPermissions.canView,
        canCreate: roleMenuPermissions.canCreate,
        canUpdate: roleMenuPermissions.canUpdate,
        canDelete: roleMenuPermissions.canDelete,
        canAccessApi: roleMenuPermissions.canAccessApi,
      })
      .from(roleMenuPermissions)
      .innerJoin(roles, eq(roleMenuPermissions.roleId, roles.id))
      .innerJoin(menus, eq(roleMenuPermissions.menuId, menus.id))
      .where(
        and(
          eq(roleMenuPermissions.roleId, roleId),
          isNull(roleMenuPermissions.deletedAt)
        )
      )
      .orderBy(menus.name);

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
          canAccessApi: payload.canAccessApi,
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
        canAccessApi: payload.canAccessApi,
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
    action: "canView" | "canCreate" | "canUpdate" | "canDelete" | "canAccessApi" | Array<"canView" | "canCreate" | "canUpdate" | "canDelete" | "canAccessApi">
  ): Promise<boolean> {
    const result = await db
      .select({
        canView: roleMenuPermissions.canView,
        canCreate: roleMenuPermissions.canCreate,
        canUpdate: roleMenuPermissions.canUpdate,
        canDelete: roleMenuPermissions.canDelete,
        canAccessApi: roleMenuPermissions.canAccessApi,
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
    
    if (Array.isArray(action)) {
      return action.some(a => perm[a] === true);
    }
    return perm[action] === true;
  }

  /**
   * Cek apakah user memiliki akses tertentu ke menu tertentu berdasarkan seluruh role yang dimilikinya.
   * Bersifat dinamis dan real-time langsung ke database.
   */
  static async checkAccessByUserId(
    userId: string,
    menuCode: string,
    action: "canView" | "canCreate" | "canUpdate" | "canDelete" | "canAccessApi" | Array<"canView" | "canCreate" | "canUpdate" | "canDelete" | "canAccessApi">
  ): Promise<boolean> {
    const userRolesList = await db
      .select({ roleId: userWarehouseRoles.roleId })
      .from(userWarehouseRoles)
      .where(and(eq(userWarehouseRoles.userId, userId), isNull(userWarehouseRoles.deletedAt)));

    if (userRolesList.length === 0) return false;
    const roleIds = userRolesList.map(r => r.roleId);

    const result = await db
      .select({
        canView: roleMenuPermissions.canView,
        canCreate: roleMenuPermissions.canCreate,
        canUpdate: roleMenuPermissions.canUpdate,
        canDelete: roleMenuPermissions.canDelete,
        canAccessApi: roleMenuPermissions.canAccessApi,
      })
      .from(roleMenuPermissions)
      .innerJoin(menus, eq(roleMenuPermissions.menuId, menus.id))
      .where(
        and(
          inArray(roleMenuPermissions.roleId, roleIds),
          eq(menus.code, menuCode),
          isNull(roleMenuPermissions.deletedAt)
        )
      );

    if (Array.isArray(action)) {
      return result.some(r => action.some(a => r[a] === true));
    }
    return result.some(r => r[action] === true);
  }

  /**
   * Mengecek apakah ada menuId yang merupakan parent menu (memiliki child).
   * Mengembalikan array menuId yang merupakan parent.
   */
  static async getParentMenuIds(menuIds: string[]): Promise<string[]> {
    if (menuIds.length === 0) return [];

    const parents = await db
      .selectDistinct({ parentId: menus.parentId })
      .from(menus)
      .where(and(inArray(menus.parentId, menuIds), isNull(menus.deletedAt)));

    return parents.map(p => p.parentId).filter(Boolean) as string[];
  }
}
