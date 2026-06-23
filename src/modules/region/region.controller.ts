import type { Context } from "elysia";
import { failedResponse, successResponse } from "../../core/utils/response";
import { db } from "../../core/db";
import { provinces, regencies, districts, villages } from "./region.schema";
import { eq } from "drizzle-orm";

export class RegionController {
  static async getProvinces(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const result = await db.select().from(provinces);
      return successResponse(correlationId, "Provinces retrieved", result);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to retrieve provinces", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async getRegencies(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const provinceId = (ctx.query as any).provinceId as string;
      if (!provinceId) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "provinceId is required", 400);
      }
      const result = await db.select().from(regencies).where(eq(regencies.provinceId, provinceId));
      return successResponse(correlationId, "Regencies retrieved", result);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to retrieve regencies", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async getDistricts(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const regencyId = (ctx.query as any).regencyId as string;
      if (!regencyId) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "regencyId is required", 400);
      }
      const result = await db.select().from(districts).where(eq(districts.regencyId, regencyId));
      return successResponse(correlationId, "Districts retrieved", result);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to retrieve districts", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }

  static async getVillages(ctx: Context) {
    const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    try {
      const districtId = (ctx.query as any).districtId as string;
      if (!districtId) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "districtId is required", 400);
      }
      const result = await db.select().from(villages).where(eq(villages.districtId, districtId));
      return successResponse(correlationId, "Villages retrieved", result);
    } catch (err: unknown) {
      ctx.set.status = 500;
      return failedResponse(correlationId, "Failed to retrieve villages", 500, err instanceof Error ? err.message : "Unknown error");
    }
  }
}
