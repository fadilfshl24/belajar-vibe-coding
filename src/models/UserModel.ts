import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";
import { toUserDTO, type UserDTO } from "../dto/UserDTO";

export type UserRecord = typeof users.$inferSelect;

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

/**
 * Parse the orderBy JSON string used by the standard API query convention.
 * Expected format: "{'CreatedAt':'DESC'}"
 * Returns { column, direction }.
 */
function parseOrderBy(orderBy: string): { column: AnyColumn; direction: "asc" | "desc" } {
  try {
    // Replace single quotes with double quotes to make it valid JSON
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

export class UserModel {
  /**
   * Find a user by email. Returns undefined if not found.
   */
  static async findByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0];
  }

  /**
   * Find a user by UUID. Returns undefined if not found.
   */
  static async findById(id: string): Promise<UserRecord | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Count all users, with optional filter support.
   */
  static async countAll(searchTerm?: string, filterColumn?: string): Promise<number> {
    const whereClause = buildFilterCondition(filterColumn, searchTerm);

    const result = await db
      .select({ total: count() })
      .from(users)
      .where(whereClause);

    return result[0]?.total ?? 0;
  }

  /**
   * Fetch a paginated, sorted, and optionally filtered list of users.
   * Returns UserDTO[] — password is never included.
   */
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
  }): Promise<UserDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition(filterColumn, searchTerm);

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

  /**
   * Insert a new user. Status defaults to 1 (active).
   * Password must already be hashed before calling this method.
   */
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
        password: payload.password,
        status: 1,
      })
      .returning();

    if (!result[0]) {
      throw new Error("Insert did not return a record");
    }

    return result[0];
  }

  /**
   * Update the status of a user and set updatedAt to now.
   * Returns the updated UserDTO, or undefined if user was not found.
   */
  static async updateStatus(id: string, status: number): Promise<UserDTO | undefined> {
    const result = await db
      .update(users)
      .set({ status: status as 0 | 1, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return result[0] ? toUserDTO(result[0]) : undefined;
  }

  /**
   * Hard delete a user row from the database.
   * (No deletedAt column on this table — use hard delete for now.)
   */
  static async deleteById(id: string): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });

    return result.length > 0;
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function buildFilterCondition(
  filterColumn?: string,
  searchTerm?: string
): ReturnType<typeof and> | undefined {
  if (!filterColumn || !searchTerm) return undefined;

  const term = searchTerm.trim();
  if (term === "") return undefined;

  switch (filterColumn) {
    case "name":
      return and(ilike(users.name, `%${term}%`));
    case "email":
      return and(ilike(users.email, `%${term}%`));
    case "status": {
      const parsed = parseInt(term, 10);
      if (isNaN(parsed)) return undefined;
      return and(eq(users.status, parsed as 0 | 1));
    }
    default:
      return undefined;
  }
}
