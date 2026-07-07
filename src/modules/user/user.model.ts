import { and, asc, count, desc, eq, ilike, isNull, notInArray, or, inArray } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { users } from "./user.schema";
import { toUserDTO, type UserDTO } from "./user.dto";
import type { UserRecord } from "./user.schema";
import { roles, userWarehouseRoles, userWarehouseMappings } from "../role/role.schema";
import { warehouses } from "../warehouse/warehouse.schema";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: users.id,
    Name: users.name,
    Email: users.email,
    Status: users.status,
    CreatedAt: users.createdAt,
    UpdatedAt: users.updatedAt,
  };
  return (map[key] ?? users.createdAt) as AnyColumn;
}

function parseOrderBy(orderBy: string): { column: AnyColumn; direction: "asc" | "desc" } {
  try {
    const normalized = orderBy.replace(/'/g, '"');
    const parsed = JSON.parse(normalized) as Record<string, string>;
    const [key, dir] = Object.entries(parsed)[0] ?? ["CreatedAt", "DESC"];
    return {
      column: resolveOrderColumn(key),
      direction: (dir?.toUpperCase() === "ASC" ? "asc" : "desc") as "asc" | "desc",
    };
  } catch {
    return { column: users.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(params: {
  searchTerm?: string;
  filterColumn?: string;
  status?: number;
  roleId?: string;
  roleCode?: string;
  warehouseId?: string;
  allowedWarehouseIds?: string[];
}) {
  const { searchTerm, filterColumn, status, roleId, roleCode, warehouseId, allowedWarehouseIds } = params;
  let conds = isNull(users.deletedAt);

  if (allowedWarehouseIds) {
    if (allowedWarehouseIds.length > 0) {
      const mappedSq = db
        .select({ id: userWarehouseMappings.userId })
        .from(userWarehouseMappings)
        .where(
          and(
            inArray(userWarehouseMappings.warehouseId, allowedWarehouseIds),
            eq(userWarehouseMappings.isActive, true),
            isNull(userWarehouseMappings.deletedAt)
          )
        );
      conds = and(conds, or(inArray(userWarehouseRoles.warehouseId, allowedWarehouseIds), inArray(users.id, mappedSq)))!;
    } else {
      // No access
      conds = and(conds, eq(users.id, "00000000-0000-0000-0000-000000000000"))!;
    }
  }

  if (status !== undefined) {
    conds = and(conds, eq(users.status, status as 0 | 1))!;
  }

  if (roleId) {
    conds = and(conds, eq(userWarehouseRoles.roleId, roleId))!;
  }

  if (roleCode) {
    conds = and(conds, eq(roles.code, roleCode))!;
  }

  if (warehouseId) {
    const mappedSq = db
      .select({ id: userWarehouseMappings.userId })
      .from(userWarehouseMappings)
      .where(
        and(
          eq(userWarehouseMappings.warehouseId, warehouseId),
          eq(userWarehouseMappings.isActive, true),
          isNull(userWarehouseMappings.deletedAt)
        )
      );
    conds = and(conds, or(eq(userWarehouseRoles.warehouseId, warehouseId), inArray(users.id, mappedSq)))!;
  }

  if (searchTerm) {
    const term = searchTerm.trim();
    if (term !== "") {
      if (filterColumn === "name") {
        conds = and(conds, ilike(users.name, `%${term}%`))!;
      } else if (filterColumn === "email") {
        conds = and(conds, ilike(users.email, `%${term}%`))!;
      } else {
        conds = and(conds, or(ilike(users.name, `%${term}%`), ilike(users.email, `%${term}%`)))!;
      }
    }
  }
  return conds;
}

/**
 * Ambil daftar userId yang sudah memiliki mapping aktif di user_warehouse_mappings
 */
async function getMappedUserIds(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: userWarehouseMappings.userId })
    .from(userWarehouseMappings)
    .where(and(eq(userWarehouseMappings.isActive, true), isNull(userWarehouseMappings.deletedAt)));
  return rows.map(r => r.userId);
}

// ---------------------------------------------------------------------------
// UserModel
// ---------------------------------------------------------------------------

export class UserModel {
  static async findByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async findById(id: string): Promise<UserDTO | undefined> {
    const result = await db
      .select({
        user: users,
        role: {
          id: roles.id,
          code: roles.code,
          name: roles.name,
        }
      })
      .from(users)
      .leftJoin(userWarehouseRoles, and(eq(users.id, userWarehouseRoles.userId), isNull(userWarehouseRoles.deletedAt)))
      .leftJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (result.length === 0) return undefined;
    return toUserDTO(result[0]!.user, result[0]!.role?.id ? result[0]!.role : null);
  }

  static async getUserRolesAndWarehouses(userId: string) {
    const userRoles = await db
      .select({
        roleName: roles.code,
      })
      .from(userWarehouseRoles)
      .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
      .where(
        and(
          eq(userWarehouseRoles.userId, userId),
          isNull(userWarehouseRoles.deletedAt),
          isNull(roles.deletedAt)
        )
      );

    const mappings = await db
      .select({ warehouseId: userWarehouseMappings.warehouseId })
      .from(userWarehouseMappings)
      .where(
        and(
          eq(userWarehouseMappings.userId, userId),
          eq(userWarehouseMappings.isActive, true),
          isNull(userWarehouseMappings.deletedAt)
        )
      );

    return {
      roleNames: userRoles.map(ur => ur.roleName),
      warehouseIds: mappings.map(m => m.warehouseId),
    };
  }

  static async countAll(params: {
    searchTerm?: string;
    filterColumn?: string;
    status?: number;
    roleId?: string;
    roleCode?: string;
    warehouseId?: string;
    excludeRoleNames?: string[];
    excludeMappedUsers?: boolean;
    allowedWarehouseIds?: string[];
  }): Promise<number> {
    const { searchTerm, filterColumn, status, roleId, roleCode, warehouseId, excludeRoleNames, excludeMappedUsers, allowedWarehouseIds } = params;
    let whereClause = buildFilterCondition({ searchTerm, filterColumn, status, roleId, roleCode, warehouseId, allowedWarehouseIds });

    // Exclude by role names
    if (excludeRoleNames && excludeRoleNames.length > 0) {
      whereClause = and(whereClause, or(isNull(roles.code), notInArray(roles.code, excludeRoleNames)))!;
    }

    // Exclude already-mapped users
    if (excludeMappedUsers) {
      const mappedIds = await getMappedUserIds();
      if (mappedIds.length > 0) {
        whereClause = and(whereClause, notInArray(users.id, mappedIds))!;
      }
    }

    const result = await db
      .select({ total: count() })
      .from(users)
      .leftJoin(userWarehouseRoles, and(eq(users.id, userWarehouseRoles.userId), isNull(userWarehouseRoles.deletedAt)))
      .leftJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
      .where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    status?: number;
    roleId?: string;
    roleCode?: string;
    warehouseId?: string;
    excludeRoleNames?: string[];
    excludeMappedUsers?: boolean;
    allowedWarehouseIds?: string[];
  }): Promise<UserDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, status, roleId, roleCode, warehouseId, excludeRoleNames, excludeMappedUsers, allowedWarehouseIds } = params;
    const { column, direction } = parseOrderBy(orderBy);
    let whereClause = buildFilterCondition({ searchTerm, filterColumn, status, roleId, roleCode, warehouseId, allowedWarehouseIds });
    const offset = (page - 1) * limit;

    if (excludeRoleNames && excludeRoleNames.length > 0) {
      whereClause = and(whereClause, or(isNull(roles.code), notInArray(roles.code, excludeRoleNames)))!;
    }

    // Exclude already-mapped users
    if (excludeMappedUsers) {
      const mappedIds = await getMappedUserIds();
      if (mappedIds.length > 0) {
        whereClause = and(whereClause, notInArray(users.id, mappedIds))!;
      }
    }

    const result = await db
      .select({
        user: users,
        role: {
          id: roles.id,
          code: roles.code,
          name: roles.name,
        }
      })
      .from(users)
      .leftJoin(userWarehouseRoles, and(eq(users.id, userWarehouseRoles.userId), isNull(userWarehouseRoles.deletedAt)))
      .leftJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(row => toUserDTO(row.user, row.role?.id ? row.role : null));
  }

  static async createUser(
    payload: {
      name: string;
      email: string;
      password?: string;
      roleId?: string;
      isActive?: boolean;
    },
    userId?: string
  ): Promise<UserRecord> {
    return await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(users)
        .values({
          name: payload.name.trim(),
          email: payload.email.toLowerCase().trim(),
          password: payload.password || null,
          status: payload.isActive ?? true ? 1 : 0,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!inserted) throw new Error("Insert did not return a record");
      
      if (payload.roleId) {
        await tx.insert(userWarehouseRoles).values({
          userId: inserted.id,
          roleId: payload.roleId,
          createdBy: userId,
          updatedBy: userId,
        });
      }
      
      return inserted;
    });
  }

  static async update(
    id: string,
    payload: {
      name?: string;
      email?: string;
      password?: string;
      roleId?: string | null;
      isActive?: boolean;
    },
    userId?: string
  ): Promise<UserDTO | undefined> {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(users)
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .limit(1);
      if (existing.length === 0) return undefined;

      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: userId,
      };
      if (payload.name !== undefined) updateData.name = payload.name.trim();
      if (payload.email !== undefined) updateData.email = payload.email.toLowerCase().trim();
      if (payload.password !== undefined) updateData.password = payload.password;
      if (payload.isActive !== undefined) updateData.status = payload.isActive ? 1 : 0;

      const [updated] = await tx
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      if (!updated) return undefined;

      if (payload.roleId !== undefined) {
        await tx.delete(userWarehouseRoles).where(eq(userWarehouseRoles.userId, id));

        if (payload.roleId) {
          await tx.insert(userWarehouseRoles).values({
            userId: id,
            roleId: payload.roleId,
            createdBy: userId,
            updatedBy: userId,
          });
        }
      }

      const result = await tx
        .select({
          user: users,
          role: {
            id: roles.id,
            code: roles.code,
            name: roles.name,
          }
        })
        .from(users)
        .leftJoin(userWarehouseRoles, and(eq(users.id, userWarehouseRoles.userId), isNull(userWarehouseRoles.deletedAt)))
        .leftJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(eq(users.id, id))
        .limit(1);

      if (result.length === 0) return undefined;
      return toUserDTO(result[0]!.user, result[0]!.role?.id ? result[0]!.role : null);
    });
  }

  static async updateStatus(id: string, status: number, userId?: string): Promise<UserDTO | undefined> {
    const result = await db
      .update(users)
      .set({ 
        status: status as 0 | 1, 
        updatedAt: new Date(),
        updatedBy: userId
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();

    return result[0] ? toUserDTO(result[0]) : undefined;
  }

  static async deleteById(id: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    return result.length > 0;
  }
}
