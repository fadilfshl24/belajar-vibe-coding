import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { menus } from "./menu.schema";
import { toMenuDTO, type MenuDTO } from "./menu.dto";
import type { MenuRecord } from "./menu.schema";

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: menus.id,
    Name: menus.name,
    Code: menus.code,
    CreatedAt: menus.createdAt,
    UpdatedAt: menus.updatedAt,
  };
  return (map[key] ?? menus.createdAt) as AnyColumn;
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
    return { column: menus.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(filterColumn?: string, searchTerm?: string, parentId?: string) {
  const conditions = [isNull(menus.deletedAt)];
  
  if (parentId !== undefined && parentId !== "") {
    if (parentId === "none") {
      conditions.push(isNull(menus.parentId));
    } else {
      conditions.push(eq(menus.parentId, parentId));
    }
  }

  if (filterColumn && searchTerm && searchTerm.trim() !== "") {
    const term = searchTerm.trim();
    switch (filterColumn) {
      case "name": conditions.push(ilike(menus.name, `%${term}%`)); break;
      case "code": conditions.push(ilike(menus.code, `%${term}%`)); break;
    }
  } else if (searchTerm && searchTerm.trim() !== "") {
    const term = searchTerm.trim();
    conditions.push(ilike(menus.name, `%${term}%`));
  }
  
  return and(...conditions);
}

export class MenuModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    parentId?: string;
  }): Promise<MenuDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, parentId } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition(filterColumn, searchTerm, parentId);
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(menus)
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(toMenuDTO);
  }

  static async countAll(searchTerm?: string, filterColumn?: string, parentId?: string): Promise<number> {
    const whereClause = buildFilterCondition(filterColumn, searchTerm, parentId);
    const result = await db.select({ total: count() }).from(menus).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<MenuRecord | undefined> {
    const result = await db
      .select()
      .from(menus)
      .where(and(eq(menus.id, id), isNull(menus.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async findByCode(code: string): Promise<MenuRecord | undefined> {
    const result = await db
      .select()
      .from(menus)
      .where(and(eq(menus.code, code), isNull(menus.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async createMenu(
    payload: {
      parentId?: string | null;
      name: string;
      code: string;
      path: string;
      sortOrder: number;
      icon?: string | null;
      isActive?: boolean;
    },
    userId?: string
  ): Promise<MenuRecord> {
    const result = await db.insert(menus).values({
      ...payload,
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    if (!result[0]) throw new Error("Failed to create menu");
    return result[0];
  }

  static async updateMenu(
    id: string,
    payload: {
      parentId?: string | null;
      name?: string;
      code?: string;
      path?: string;
      sortOrder?: number;
      icon?: string | null;
      isActive?: boolean;
    },
    userId?: string
  ): Promise<MenuDTO | undefined> {
    const result = await db
      .update(menus)
      .set({ 
        ...payload, 
        updatedAt: new Date(),
        updatedBy: userId
      })
      .where(and(eq(menus.id, id), isNull(menus.deletedAt)))
      .returning();
    return result[0] ? toMenuDTO(result[0]) : undefined;
  }

  static async softDelete(id: string): Promise<boolean> {
    const activeChildren = await db
      .select({ total: count() })
      .from(menus)
      .where(and(eq(menus.parentId, id), isNull(menus.deletedAt)));

    if ((activeChildren[0]?.total ?? 0) > 0) {
      throw new Error("Cannot delete menu because it has active children");
    }

    const result = await db
      .update(menus)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(menus.id, id), isNull(menus.deletedAt)))
      .returning({ id: menus.id });
    return result.length > 0;
  }
}
