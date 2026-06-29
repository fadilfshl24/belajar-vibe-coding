import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { platforms } from "./platform.schema";
import { toPlatformDTO, type PlatformDTO } from "./platform.dto";
import type { PlatformRecord, PlatformInsert } from "./platform.schema";

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: platforms.id,
    Code: platforms.code,
    Name: platforms.name,
    CreatedAt: platforms.createdAt,
    UpdatedAt: platforms.updatedAt,
  };
  return (map[key] ?? platforms.createdAt) as AnyColumn;
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
    return { column: platforms.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(params: { filterColumn?: string; searchTerm?: string; isActive?: boolean }) {
  const { filterColumn, searchTerm, isActive } = params;
  let conds = isNull(platforms.deletedAt);
  if (isActive !== undefined) {
    conds = and(conds, eq(platforms.isActive, isActive))!;
  }
  if (searchTerm) {
    const term = searchTerm.trim();
    if (term !== "") {
      if (filterColumn === "name") {
        conds = and(conds, ilike(platforms.name, `%${term}%`))!;
      } else if (filterColumn === "code") {
        conds = and(conds, ilike(platforms.code, `%${term}%`))!;
      } else {
        conds = and(conds, or(ilike(platforms.name, `%${term}%`), ilike(platforms.code, `%${term}%`)))!;
      }
    }
  }
  return conds;
}

export class PlatformModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    isActive?: boolean;
  }): Promise<PlatformDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, isActive } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition({ filterColumn, searchTerm, isActive });
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(platforms)
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(toPlatformDTO);
  }

  static async countAll(params: { searchTerm?: string; filterColumn?: string; isActive?: boolean }): Promise<number> {
    const whereClause = buildFilterCondition(params);
    const result = await db.select({ total: count() }).from(platforms).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<PlatformRecord | undefined> {
    const result = await db
      .select()
      .from(platforms)
      .where(and(eq(platforms.id, id), isNull(platforms.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async findByCode(code: string): Promise<PlatformRecord | undefined> {
    const result = await db
      .select()
      .from(platforms)
      .where(and(eq(platforms.code, code), isNull(platforms.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async create(payload: Omit<PlatformInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">): Promise<PlatformRecord> {
    const result = await db.insert(platforms).values({
      ...payload,
      code: payload.code.toUpperCase(),
    }).returning();
    if (!result[0]) throw new Error("Failed to create platform");
    return result[0];
  }

  static async update(
    id: string,
    payload: Partial<Omit<PlatformInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">>
  ): Promise<PlatformDTO | undefined> {
    const result = await db
      .update(platforms)
      .set({ 
        ...payload, 
        ...(payload.code ? { code: payload.code.toUpperCase() } : {}),
        updatedAt: new Date() 
      })
      .where(and(eq(platforms.id, id), isNull(platforms.deletedAt)))
      .returning();
    return result[0] ? toPlatformDTO(result[0]) : undefined;
  }

  static async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(platforms)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(platforms.id, id), isNull(platforms.deletedAt)))
      .returning({ id: platforms.id });
    return result.length > 0;
  }
}
