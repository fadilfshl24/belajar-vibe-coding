import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { itemCategories } from "./category.schema";
import { items } from "../item/item.schema";
import { toCategoryDTO, type CategoryDTO } from "./category.dto";
import type { ItemCategoryRecord } from "./category.schema";

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: itemCategories.id,
    Code: itemCategories.code,
    Name: itemCategories.name,
    CreatedAt: itemCategories.createdAt,
    UpdatedAt: itemCategories.updatedAt,
  };
  return (map[key] ?? itemCategories.createdAt) as AnyColumn;
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
    return { column: itemCategories.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(params: { filterColumn?: string; searchTerm?: string; isActive?: boolean }) {
  const { filterColumn, searchTerm, isActive } = params;
  let conds = isNull(itemCategories.deletedAt);
  if (isActive !== undefined) {
    conds = and(conds, eq(itemCategories.isActive, isActive))!;
  }
  if (searchTerm) {
    const term = searchTerm.trim();
    if (term !== "") {
      if (filterColumn === "name") {
        conds = and(conds, ilike(itemCategories.name, `%${term}%`))!;
      } else if (filterColumn === "code") {
        conds = and(conds, ilike(itemCategories.code, `%${term}%`))!;
      } else {
        conds = and(conds, or(ilike(itemCategories.name, `%${term}%`), ilike(itemCategories.code, `%${term}%`)))!;
      }
    }
  }
  return conds;
}

export class CategoryModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    isActive?: boolean;
  }): Promise<CategoryDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, isActive } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition({ filterColumn, searchTerm, isActive });
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(itemCategories)
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(toCategoryDTO);
  }

  static async countAll(params: { searchTerm?: string; filterColumn?: string; isActive?: boolean }): Promise<number> {
    const whereClause = buildFilterCondition(params);
    const result = await db.select({ total: count() }).from(itemCategories).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<ItemCategoryRecord | undefined> {
    const result = await db
      .select()
      .from(itemCategories)
      .where(and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async findByCode(code: string): Promise<ItemCategoryRecord | undefined> {
    const result = await db
      .select()
      .from(itemCategories)
      .where(and(eq(itemCategories.code, code), isNull(itemCategories.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async create(payload: {
    name: string;
    code: string;
    description?: string;
    isActive?: boolean;
  }): Promise<ItemCategoryRecord> {
    const result = await db.insert(itemCategories).values({
      ...payload,
      code: payload.code.toUpperCase(),
    }).returning();
    if (!result[0]) throw new Error("Failed to create category");
    return result[0];
  }

  static async update(
    id: string,
    payload: { name?: string; code?: string; description?: string; isActive?: boolean }
  ): Promise<CategoryDTO | undefined> {
    const result = await db
      .update(itemCategories)
      .set({ 
        ...payload, 
        ...(payload.code ? { code: payload.code.toUpperCase() } : {}),
        updatedAt: new Date() 
      })
      .where(and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)))
      .returning();
    return result[0] ? toCategoryDTO(result[0]) : undefined;
  }

  static async softDelete(id: string): Promise<boolean> {
    // Check if category is used by items
    const checkItems = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.categoryId, id), isNull(items.deletedAt)))
      .limit(1);
    if (checkItems.length > 0) {
      throw new Error("Category is being used by active items");
    }

    const result = await db
      .update(itemCategories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)))
      .returning({ id: itemCategories.id });
    return result.length > 0;
  }
}
