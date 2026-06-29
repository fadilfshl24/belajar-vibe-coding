import { z } from "zod";

export const createPlatformSchema = z.object({
  code: z.string().min(1, "Code is required").max(100).toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  image: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

export const updatePlatformSchema = createPlatformSchema.partial();

export const platformListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  isActive: z.string().optional().transform(val => val === "true" ? true : val === "false" ? false : undefined),
});

export function parseCreatePlatformInput(body: unknown) {
  return createPlatformSchema.safeParse(body);
}

export function parseUpdatePlatformInput(body: unknown) {
  return updatePlatformSchema.safeParse(body);
}

export function parsePlatformListQuery(query: unknown) {
  return platformListQuerySchema.safeParse(query);
}

export type CreatePlatformInput = z.infer<typeof createPlatformSchema>;
export type UpdatePlatformInput = z.infer<typeof updatePlatformSchema>;
export type PlatformListQuery = z.infer<typeof platformListQuerySchema>;
