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

function buildFilterCondition(filterColumn?: string, searchTerm?: string) {
  if (!filterColumn || !searchTerm) return isNull(menus.deletedAt);
  const term = searchTerm.trim();
  if (term === "") return isNull(menus.deletedAt);
  switch (filterColumn) {
    case "name": return and(ilike(menus.name, `%${term}%`), isNull(menus.deletedAt));
    case "code": return and(ilike(menus.code, `%${term}%`), isNull(menus.deletedAt));
    default: return isNull(menus.deletedAt);
  }
}

export class MenuModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
  }): Promise<MenuDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition(filterColumn, searchTerm);
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

  static async countAll(searchTerm?: string, filterColumn?: string): Promise<number> {
    const whereClause = buildFilterCondition(filterColumn, searchTerm);
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

  static async createMenu(payload: {
    name: string;
    code: string;
    path: string;
  }): Promise<MenuRecord> {
    const result = await db.insert(menus).values(payload).returning();
    if (!result[0]) throw new Error("Failed to create menu");
    return result[0];
  }

  static async updateMenu(
    id: string,
    payload: { name?: string; code?: string; path?: string }
  ): Promise<MenuDTO | undefined> {
    const result = await db
      .update(menus)
      .set({ ...payload, updatedAt: new Date() })
      .where(and(eq(menus.id, id), isNull(menus.deletedAt)))
      .returning();
    return result[0] ? toMenuDTO(result[0]) : undefined;
  }

  static async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(menus)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(menus.id, id), isNull(menus.deletedAt)))
      .returning({ id: menus.id });
    return result.length > 0;
  }
}
