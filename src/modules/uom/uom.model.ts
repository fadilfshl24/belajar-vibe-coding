import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { uoms } from "./uom.schema";
import { items } from "../item/item.schema";
import { toUomDTO, type UomDTO } from "./uom.dto";
import type { UomRecord } from "./uom.schema";

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: uoms.id,
    Code: uoms.code,
    Name: uoms.name,
    CreatedAt: uoms.createdAt,
    UpdatedAt: uoms.updatedAt,
  };
  return (map[key] ?? uoms.createdAt) as AnyColumn;
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
    return { column: uoms.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(filterColumn?: string, searchTerm?: string) {
  if (!filterColumn || !searchTerm) return isNull(uoms.deletedAt);
  const term = searchTerm.trim();
  if (term === "") return isNull(uoms.deletedAt);
  switch (filterColumn) {
    case "name": return and(ilike(uoms.name, `%${term}%`), isNull(uoms.deletedAt));
    case "code": return and(ilike(uoms.code, `%${term}%`), isNull(uoms.deletedAt));
    default: return isNull(uoms.deletedAt);
  }
}

export class UomModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
  }): Promise<UomDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition(filterColumn, searchTerm);
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(uoms)
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(toUomDTO);
  }

  static async countAll(searchTerm?: string, filterColumn?: string): Promise<number> {
    const whereClause = buildFilterCondition(filterColumn, searchTerm);
    const result = await db.select({ total: count() }).from(uoms).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<UomRecord | undefined> {
    const result = await db
      .select()
      .from(uoms)
      .where(and(eq(uoms.id, id), isNull(uoms.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async findByCode(code: string): Promise<UomRecord | undefined> {
    const result = await db
      .select()
      .from(uoms)
      .where(and(eq(uoms.code, code), isNull(uoms.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async create(payload: {
    name: string;
    code: string;
    description?: string;
    isActive?: boolean;
  }): Promise<UomRecord> {
    const result = await db.insert(uoms).values({
      ...payload,
      code: payload.code.toUpperCase(),
    }).returning();
    if (!result[0]) throw new Error("Failed to create UOM");
    return result[0];
  }

  static async update(
    id: string,
    payload: { name?: string; code?: string; description?: string; isActive?: boolean }
  ): Promise<UomDTO | undefined> {
    const result = await db
      .update(uoms)
      .set({ 
        ...payload, 
        ...(payload.code ? { code: payload.code.toUpperCase() } : {}),
        updatedAt: new Date() 
      })
      .where(and(eq(uoms.id, id), isNull(uoms.deletedAt)))
      .returning();
    return result[0] ? toUomDTO(result[0]) : undefined;
  }

  static async softDelete(id: string): Promise<boolean> {
    // Check if UOM is used by items
    const checkItems = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.uomId, id), isNull(items.deletedAt)))
      .limit(1);
    if (checkItems.length > 0) {
      throw new Error("UOM is being used by active items");
    }

    const result = await db
      .update(uoms)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(uoms.id, id), isNull(uoms.deletedAt)))
      .returning({ id: uoms.id });
    return result.length > 0;
  }
}
