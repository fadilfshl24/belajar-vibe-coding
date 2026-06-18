import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  email: z.email("Email format is invalid").max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function parseCreateUserInput(body: unknown) {
  return createUserSchema.safeParse(body);
}

export type CreateUserInput = z.infer<typeof createUserSchema>;

const updateStatusSchema = z.object({
  status: z.number().int().min(0).max(1),
});

export function parseUpdateStatusInput(body: unknown) {
  return updateStatusSchema.safeParse(body);
}

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  orderBy: z.string().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
});

export function parseListQuery(query: unknown) {
  return listQuerySchema.safeParse(query);
}

export type ListQuery = z.infer<typeof listQuerySchema>;
