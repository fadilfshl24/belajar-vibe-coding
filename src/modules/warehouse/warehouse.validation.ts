import { z } from "zod";

// ---------------------------------------------------------------------------
// Warehouse schemas
// ---------------------------------------------------------------------------

const createWarehouseSchema = z.object({
  code: z.string().min(1, "Code is required").max(100).toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  description: z.string().max(2000).optional(),
  address: z.string().max(1000).optional(),
  province: z.string().max(20).optional(),
  cityRegency: z.string().max(20).optional(),
  district: z.string().max(20).optional(),
  village: z.string().max(20).optional(),
  zipCode: z.string().max(10).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().optional().default(true),
});

const updateWarehouseSchema = createWarehouseSchema.partial();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  isActive: z.string().optional().transform(val => val === "true" ? true : val === "false" ? false : undefined),
});

// ---------------------------------------------------------------------------
// Warehouse Head schemas
// ---------------------------------------------------------------------------

const assignWarehouseHeadSchema = z.object({
  userId: z.string().uuid("Invalid user UUID"),
  description: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function parseCreateWarehouseInput(body: unknown) {
  return createWarehouseSchema.safeParse(body);
}

export function parseUpdateWarehouseInput(body: unknown) {
  return updateWarehouseSchema.safeParse(body);
}

export function parseWarehouseListQuery(query: unknown) {
  return listQuerySchema.safeParse(query);
}

export function parseAssignWarehouseHeadInput(body: unknown) {
  return assignWarehouseHeadSchema.safeParse(body);
}

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type AssignWarehouseHeadInput = z.infer<typeof assignWarehouseHeadSchema>;
