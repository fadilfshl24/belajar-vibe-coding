import { and, count, desc, eq, gte, ilike, isNull, lte, or } from "drizzle-orm";
import { db } from "../../core/db";
import { activityLogs } from "./activity-log.schema";
import { toActivityLogDTO, type ActivityLogDTO } from "./activity-log.dto";
import type { ActivityLogQuery } from "./activity-log.validation";

export class ActivityLogModel {
  static async countAll(filters: ActivityLogQuery): Promise<number> {
    const where = buildWhere(filters);
    const result = await db.select({ total: count() }).from(activityLogs).where(where);
    return result[0]?.total ?? 0;
  }

  static async findAll(filters: ActivityLogQuery): Promise<ActivityLogDTO[]> {
    const where = buildWhere(filters);
    const offset = (filters.page - 1) * filters.limit;

    const result = await db
      .select()
      .from(activityLogs)
      .where(where)
      .orderBy(desc(activityLogs.createdAt))
      .limit(filters.limit)
      .offset(offset);

    return result.map(toActivityLogDTO);
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function buildWhere(filters: ActivityLogQuery) {
  const conditions = [isNull(activityLogs.deletedAt)];

  if (filters.userId) {
    conditions.push(eq(activityLogs.userId, filters.userId));
  }

  if (filters.action) {
    conditions.push(eq(activityLogs.action, filters.action.toUpperCase()));
  }

  if (filters.startDate) {
    conditions.push(gte(activityLogs.createdAt, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(activityLogs.createdAt, filters.endDate));
  }

  if (filters.searchTerm) {
    const term = `%${filters.searchTerm.trim()}%`;
    conditions.push(
      or(
        ilike(activityLogs.description, term),
        ilike(activityLogs.username, term)
      ) as any
    );
  }

  return and(...conditions);
}
