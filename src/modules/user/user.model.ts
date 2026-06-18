import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { users } from "./user.schema";
import { toUserDTO, type UserDTO } from "./user.dto";
import type { UserRecord } from "./user.schema";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: users.id,
    Name: users.name,
    Email: users.email,
    Status: users.status,
    CreatedAt: users.createdAt,
    UpdatedAt: users.updatedAt,
  };
  return (map[key] ?? users.createdAt) as AnyColumn;
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
    return { column: users.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(filterColumn?: string, searchTerm?: string) {
  if (!filterColumn || !searchTerm) return undefined;
  const term = searchTerm.trim();
  if (term === "") return undefined;

  switch (filterColumn) {
    case "name":
      return and(ilike(users.name, `%${term}%`), isNull(users.deletedAt));
    case "email":
      return and(ilike(users.email, `%${term}%`), isNull(users.deletedAt));
    case "status": {
      const parsed = parseInt(term, 10);
      if (isNaN(parsed)) return undefined;
      return and(eq(users.status, parsed as 0 | 1), isNull(users.deletedAt));
    }
    default:
      return isNull(users.deletedAt);
  }
}

// ---------------------------------------------------------------------------
// UserModel
// ---------------------------------------------------------------------------

export class UserModel {
  static async findByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async findById(id: string): Promise<UserRecord | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return result[0];
  }

  static async countAll(searchTerm?: string, filterColumn?: string): Promise<number> {
    const whereClause = buildFilterCondition(filterColumn, searchTerm) ?? isNull(users.deletedAt);
    const result = await db.select({ total: count() }).from(users).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
  }): Promise<UserDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition(filterColumn, searchTerm) ?? isNull(users.deletedAt);
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(toUserDTO);
  }

  static async createUser(payload: {
    name: string;
    email: string;
    password: string;
  }): Promise<UserRecord> {
    const result = await db
      .insert(users)
      .values({
        name: payload.name.trim(),
        email: payload.email.toLowerCase().trim(),
        password: payload.password || null,
        status: 1,
      })
      .returning();

    if (!result[0]) throw new Error("Insert did not return a record");
    return result[0];
  }

  static async updateStatus(id: string, status: number): Promise<UserDTO | undefined> {
    const result = await db
      .update(users)
      .set({ status: status as 0 | 1, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();

    return result[0] ? toUserDTO(result[0]) : undefined;
  }

  /** Soft delete */
  static async deleteById(id: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    return result.length > 0;
  }
}
