import { z } from "zod";

const createCategorySchema = z.object({
  code: z.string().min(1, "Code is required").max(100).toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional().default(true),
});

const updateCategorySchema = createCategorySchema.partial();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
});

export function parseCreateCategoryInput(body: unknown) {
  return createCategorySchema.safeParse(body);
}

export function parseUpdateCategoryInput(body: unknown) {
  return updateCategorySchema.safeParse(body);
}

export function parseCategoryListQuery(query: unknown) {
  return listQuerySchema.safeParse(query);
}

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryListQuery = z.infer<typeof listQuerySchema>;
