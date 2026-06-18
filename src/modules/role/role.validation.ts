import { z } from "zod";

const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(255)
    .regex(/^[a-z_]+$/, "Name must be lowercase with underscores only (e.g., warehouse_head)"),
  description: z.string().max(1000).optional(),
});

export function parseCreateRoleInput(body: unknown) {
  return createRoleSchema.safeParse(body);
}

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

const updateRoleSchema = createRoleSchema.partial();

export function parseUpdateRoleInput(body: unknown) {
  return updateRoleSchema.safeParse(body);
}

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
