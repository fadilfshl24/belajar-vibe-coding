import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
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

function buildFilterCondition(filterColumn?: string, searchTerm?: string) {
  if (!filterColumn || !searchTerm) return isNull(itemCategories.deletedAt);
  const term = searchTerm.trim();
  if (term === "") return isNull(itemCategories.deletedAt);
  switch (filterColumn) {
    case "name": return and(ilike(itemCategories.name, `%${term}%`), isNull(itemCategories.deletedAt));
    case "code": return and(ilike(itemCategories.code, `%${term}%`), isNull(itemCategories.deletedAt));
    default: return isNull(itemCategories.deletedAt);
  }
}

export class CategoryModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
  }): Promise<CategoryDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition(filterColumn, searchTerm);
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

  static async countAll(searchTerm?: string, filterColumn?: string): Promise<number> {
    const whereClause = buildFilterCondition(filterColumn, searchTerm);
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
