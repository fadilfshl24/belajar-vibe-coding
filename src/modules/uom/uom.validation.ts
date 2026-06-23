import { z } from "zod";

const createUomSchema = z.object({
  code: z.string().min(1, "Code is required").max(100).toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional().default(true),
});

const updateUomSchema = createUomSchema.partial();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  isActive: z.string().optional().transform(val => val === "true" ? true : val === "false" ? false : undefined),
});

export function parseCreateUomInput(body: unknown) {
  return createUomSchema.safeParse(body);
}

export function parseUpdateUomInput(body: unknown) {
  return updateUomSchema.safeParse(body);
}

export function parseUomListQuery(query: unknown) {
  return listQuerySchema.safeParse(query);
}

export type CreateUomInput = z.infer<typeof createUomSchema>;
export type UpdateUomInput = z.infer<typeof updateUomSchema>;
export type UomListQuery = z.infer<typeof listQuerySchema>;
