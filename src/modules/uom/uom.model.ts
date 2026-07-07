import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
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

function buildFilterCondition(params: { filterColumn?: string; searchTerm?: string; isActive?: boolean }) {
  const { filterColumn, searchTerm, isActive } = params;
  let conds = isNull(uoms.deletedAt);
  if (isActive !== undefined) {
    conds = and(conds, eq(uoms.isActive, isActive))!;
  }
  if (searchTerm) {
    const term = searchTerm.trim();
    if (term !== "") {
      if (filterColumn === "name") {
        conds = and(conds, ilike(uoms.name, `%${term}%`))!;
      } else if (filterColumn === "code") {
        conds = and(conds, ilike(uoms.code, `%${term}%`))!;
      } else {
        conds = and(conds, or(ilike(uoms.name, `%${term}%`), ilike(uoms.code, `%${term}%`)))!;
      }
    }
  }
  return conds;
}

export class UomModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    isActive?: boolean;
  }): Promise<UomDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, isActive } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition({ filterColumn, searchTerm, isActive });
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

  static async countAll(params: { searchTerm?: string; filterColumn?: string; isActive?: boolean }): Promise<number> {
    const whereClause = buildFilterCondition(params);
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

  static async create(
    payload: {
      name: string;
      code: string;
      description?: string;
      isActive?: boolean;
    },
    userId?: string
  ): Promise<UomRecord> {
    const result = await db.insert(uoms).values({
      ...payload,
      code: payload.code.toUpperCase(),
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    if (!result[0]) throw new Error("Failed to create UOM");
    return result[0];
  }

  static async update(
    id: string,
    payload: { name?: string; code?: string; description?: string; isActive?: boolean },
    userId?: string
  ): Promise<UomDTO | undefined> {
    const result = await db
      .update(uoms)
      .set({ 
        ...payload, 
        ...(payload.code ? { code: payload.code.toUpperCase() } : {}),
        updatedAt: new Date(),
        updatedBy: userId
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
