import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  email: z.string().email("Email format is invalid").max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255).optional(),
  email: z.string().email("Email format is invalid").max(255).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  roleId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export function parseCreateUserInput(body: unknown) {
  return createUserSchema.safeParse(body);
}

export function parseUpdateUserInput(body: unknown) {
  return updateUserSchema.safeParse(body);
}

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

const updateStatusSchema = z.object({
  status: z.number().int().min(0).max(1),
});

export function parseUpdateStatusInput(body: unknown) {
  return updateStatusSchema.safeParse(body);
}

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  roleId: z.string().uuid().optional(),
  // Exclude users by role name (comma-separated), e.g. "superadmin,admin"
  excludeRoleNames: z.string().optional(),
  // Exclude users that already have active warehouse mappings
  excludeMappedUsers: z.coerce.boolean().optional(),
});

export function parseListQuery(query: unknown) {
  return listQuerySchema.safeParse(query);
}

export type ListQuery = z.infer<typeof listQuerySchema>;
