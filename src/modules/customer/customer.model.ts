import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { customers } from "./customer.schema";
import { toCustomerDTO, type CustomerDTO } from "./customer.dto";
import type { CustomerRecord, CustomerInsert } from "./customer.schema";

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: customers.id,
    Code: customers.code,
    Name: customers.name,
    CreatedAt: customers.createdAt,
    UpdatedAt: customers.updatedAt,
  };
  return (map[key] ?? customers.createdAt) as AnyColumn;
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
    return { column: customers.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(params: { filterColumn?: string; searchTerm?: string; isActive?: boolean; type?: "company" | "personal" }) {
  const { filterColumn, searchTerm, isActive, type } = params;
  let conds = isNull(customers.deletedAt);
  if (isActive !== undefined) {
    conds = and(conds, eq(customers.isActive, isActive))!;
  }
  if (type !== undefined) {
    conds = and(conds, eq(customers.type, type))!;
  }
  if (searchTerm) {
    const term = searchTerm.trim();
    if (term !== "") {
      if (filterColumn === "name") {
        conds = and(conds, ilike(customers.name, `%${term}%`))!;
      } else if (filterColumn === "code") {
        conds = and(conds, ilike(customers.code, `%${term}%`))!;
      } else if (filterColumn === "email") {
        conds = and(conds, ilike(customers.email, `%${term}%`))!;
      } else {
        conds = and(conds, or(ilike(customers.name, `%${term}%`), ilike(customers.code, `%${term}%`), ilike(customers.email, `%${term}%`)))!;
      }
    }
  }
  return conds;
}

export class CustomerModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    isActive?: boolean;
    type?: "company" | "personal";
  }): Promise<CustomerDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, isActive, type } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition({ filterColumn, searchTerm, isActive, type });
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(toCustomerDTO);
  }

  static async countAll(params: { searchTerm?: string; filterColumn?: string; isActive?: boolean; type?: "company" | "personal" }): Promise<number> {
    const whereClause = buildFilterCondition(params);
    const result = await db.select({ total: count() }).from(customers).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<CustomerRecord | undefined> {
    const result = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async findByCode(code: string): Promise<CustomerRecord | undefined> {
    const result = await db
      .select()
      .from(customers)
      .where(and(eq(customers.code, code), isNull(customers.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async create(payload: Omit<CustomerInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">): Promise<CustomerRecord> {
    const result = await db.insert(customers).values({
      ...payload,
      code: payload.code.toUpperCase(),
    }).returning();
    if (!result[0]) throw new Error("Failed to create customer");
    return result[0];
  }

  static async update(
    id: string,
    payload: Partial<Omit<CustomerInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">>
  ): Promise<CustomerDTO | undefined> {
    const result = await db
      .update(customers)
      .set({ 
        ...payload, 
        ...(payload.code ? { code: payload.code.toUpperCase() } : {}),
        updatedAt: new Date() 
      })
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .returning();
    return result[0] ? toCustomerDTO(result[0]) : undefined;
  }

  static async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(customers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .returning({ id: customers.id });
    return result.length > 0;
  }
}
