import type { Context } from "elysia";
import { failedResponse, successResponse, type PaginationMeta } from "../../core/utils/response";
import { ActivityLogModel } from "./activity-log.model";
import { parseActivityLogQuery } from "./activity-log.validation";

export class ActivityLogController {
  // ---------------------------------------------------------------------------
  // GET /api/activity-logs — Daftar log aktivitas (Admin & Superadmin)
  // ---------------------------------------------------------------------------
  static async getAll(ctx: Context) {
    const correlationId =
      (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

    try {
      const parsed = parseActivityLogQuery(ctx.query);
      if (!parsed.success) {
        return failedResponse(
          correlationId,
          "Query parameter invalid!",
          400,
          parsed.error.issues[0]?.message
        );
      }

      const filters = parsed.data;

      const [totalRecord, records] = await Promise.all([
        ActivityLogModel.countAll(filters),
        ActivityLogModel.findAll(filters),
      ]);

      const totalPage = Math.ceil(totalRecord / filters.limit);
      const baseUrl = (process.env.APP_URL ?? "http://localhost:3000") + "/api/activity-logs";

      const buildUrl = (p: number) => {
        const params = new URLSearchParams({ page: String(p), limit: String(filters.limit) });
        if (filters.userId) params.set("userId", filters.userId);
        if (filters.action) params.set("action", filters.action);
        if (filters.searchTerm) params.set("searchTerm", filters.searchTerm);
        return `${baseUrl}?${params.toString()}`;
      };

      const pagination: PaginationMeta = {
        page: filters.page,
        limit: filters.limit,
        totalRecord,
        totalPage,
        nextPage: filters.page < totalPage,
        previousPage: filters.page > 1,
        nextPageURL: filters.page < totalPage ? buildUrl(filters.page + 1) : "",
        previousPageURL: filters.page > 1 ? buildUrl(filters.page - 1) : "",
        filterColumn: filters.userId ? "userId" : "",
        searchTerm: filters.searchTerm ?? "",
        orderBy: "{'CreatedAt':'DESC'}",
      };

      return successResponse(correlationId, "Data found!", { records }, pagination);
    } catch (err: unknown) {
      return failedResponse(correlationId, "Internal server error", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
