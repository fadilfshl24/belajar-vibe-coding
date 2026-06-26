import { z } from "zod";

export const activityLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  module: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  searchTerm: z.string().optional(),
});

export function parseActivityLogQuery(query: unknown) {
  return activityLogQuerySchema.safeParse(query);
}

export type ActivityLogQuery = z.infer<typeof activityLogQuerySchema>;
