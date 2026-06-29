import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { vendors } from "./vendor.schema";
import { toVendorDTO, type VendorDTO } from "./vendor.dto";
import type { VendorRecord, VendorInsert } from "./vendor.schema";

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: vendors.id,
    Code: vendors.code,
    Name: vendors.name,
    CreatedAt: vendors.createdAt,
    UpdatedAt: vendors.updatedAt,
  };
  return (map[key] ?? vendors.createdAt) as AnyColumn;
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
    return { column: vendors.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(params: { filterColumn?: string; searchTerm?: string; isActive?: boolean }) {
  const { filterColumn, searchTerm, isActive } = params;
  let conds = isNull(vendors.deletedAt);
  if (isActive !== undefined) {
    conds = and(conds, eq(vendors.isActive, isActive))!;
  }
  if (searchTerm) {
    const term = searchTerm.trim();
    if (term !== "") {
      if (filterColumn === "name") {
        conds = and(conds, ilike(vendors.name, `%${term}%`))!;
      } else if (filterColumn === "code") {
        conds = and(conds, ilike(vendors.code, `%${term}%`))!;
      } else if (filterColumn === "email") {
        conds = and(conds, ilike(vendors.email, `%${term}%`))!;
      } else {
        conds = and(conds, or(ilike(vendors.name, `%${term}%`), ilike(vendors.code, `%${term}%`), ilike(vendors.email, `%${term}%`)))!;
      }
    }
  }
  return conds;
}

export class VendorModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    isActive?: boolean;
  }): Promise<VendorDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, isActive } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition({ filterColumn, searchTerm, isActive });
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(vendors)
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(toVendorDTO);
  }

  static async countAll(params: { searchTerm?: string; filterColumn?: string; isActive?: boolean }): Promise<number> {
    const whereClause = buildFilterCondition(params);
    const result = await db.select({ total: count() }).from(vendors).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<VendorRecord | undefined> {
    const result = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, id), isNull(vendors.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async findByCode(code: string): Promise<VendorRecord | undefined> {
    const result = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.code, code), isNull(vendors.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async create(payload: Omit<VendorInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">): Promise<VendorRecord> {
    const result = await db.insert(vendors).values({
      ...payload,
      code: payload.code.toUpperCase(),
    }).returning();
    if (!result[0]) throw new Error("Failed to create vendor");
    return result[0];
  }

  static async update(
    id: string,
    payload: Partial<Omit<VendorInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">>
  ): Promise<VendorDTO | undefined> {
    const result = await db
      .update(vendors)
      .set({ 
        ...payload, 
        ...(payload.code ? { code: payload.code.toUpperCase() } : {}),
        updatedAt: new Date() 
      })
      .where(and(eq(vendors.id, id), isNull(vendors.deletedAt)))
      .returning();
    return result[0] ? toVendorDTO(result[0]) : undefined;
  }

  static async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(vendors)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(vendors.id, id), isNull(vendors.deletedAt)))
      .returning({ id: vendors.id });
    return result.length > 0;
  }
}
