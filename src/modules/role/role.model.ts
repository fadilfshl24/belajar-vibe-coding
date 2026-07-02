import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { roles } from "./role.schema";
import { toRoleDTO, type RoleDTO } from "./role.dto";
import type { RoleRecord } from "./role.schema";

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: roles.id,
    Name: roles.name,
    CreatedAt: roles.createdAt,
    UpdatedAt: roles.updatedAt,
  };
  return (map[key] ?? roles.createdAt) as AnyColumn;
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
    return { column: roles.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(filterColumn?: string, searchTerm?: string) {
  if (!filterColumn || !searchTerm) return isNull(roles.deletedAt);
  const term = searchTerm.trim();
  if (term === "") return isNull(roles.deletedAt);
  switch (filterColumn) {
    case "name": return and(ilike(roles.name, `%${term}%`), isNull(roles.deletedAt));
    default: return isNull(roles.deletedAt);
  }
}

export class RoleModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
  }): Promise<RoleDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition(filterColumn, searchTerm);
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(roles)
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(toRoleDTO);
  }

  static async countAll(searchTerm?: string, filterColumn?: string): Promise<number> {
    const whereClause = buildFilterCondition(filterColumn, searchTerm);
    const result = await db.select({ total: count() }).from(roles).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<RoleRecord | undefined> {
    const result = await db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), isNull(roles.deletedAt)))
      .limit(1);

    return result[0];
  }

  static async findByName(name: string): Promise<RoleRecord | undefined> {
    const result = await db
      .select()
      .from(roles)
      .where(and(eq(roles.name, name), isNull(roles.deletedAt)))
      .limit(1);

    return result[0];
  }

  static async createRole(
    payload: {
      name: string;
      description?: string;
    },
    userId?: string
  ): Promise<RoleRecord> {
    const result = await db
      .insert(roles)
      .values({ 
        name: payload.name, 
        description: payload.description,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    if (!result[0]) throw new Error("Failed to create role");
    return result[0];
  }

  static async updateRole(
    id: string,
    payload: { name?: string; description?: string },
    userId?: string
  ): Promise<RoleDTO | undefined> {
    const result = await db
      .update(roles)
      .set({ 
        ...payload, 
        updatedAt: new Date(),
        updatedBy: userId
      })
      .where(and(eq(roles.id, id), isNull(roles.deletedAt)))
      .returning();

    return result[0] ? toRoleDTO(result[0]) : undefined;
  }

  static async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(roles)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(roles.id, id), isNull(roles.deletedAt)))
      .returning({ id: roles.id });

    return result.length > 0;
  }
}
