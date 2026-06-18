import { z } from "zod";

const createMenuSchema = z.object({
  name: z.string().min(2).max(255),
  code: z
    .string()
    .min(2)
    .max(255)
    .regex(/^[a-z_]+$/, "Code must be lowercase with underscores only (e.g., master_data)"),
  path: z
    .string()
    .min(1)
    .max(255)
    .startsWith("/", "Path must start with /"),
});

export function parseCreateMenuInput(body: unknown) {
  return createMenuSchema.safeParse(body);
}

export type CreateMenuInput = z.infer<typeof createMenuSchema>;

const updateMenuSchema = createMenuSchema.partial();

export function parseUpdateMenuInput(body: unknown) {
  return updateMenuSchema.safeParse(body);
}

export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;
