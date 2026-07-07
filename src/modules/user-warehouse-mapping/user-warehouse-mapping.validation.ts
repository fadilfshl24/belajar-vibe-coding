import { z } from "zod";

export const createMappingSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  warehouseIds: z.array(z.string().uuid("Invalid warehouse ID format")).min(1, "At least one warehouse ID is required"),
});

export const getMappingsQuerySchema = z.object({
  userId: z.string().uuid("Invalid user ID format").optional(),
});

export type CreateMappingInput = z.infer<typeof createMappingSchema>;

export const parseCreateMappingInput = (data: unknown) => createMappingSchema.safeParse(data);
export const parseGetMappingsQuery = (data: unknown) => getMappingsQuerySchema.safeParse(data);
