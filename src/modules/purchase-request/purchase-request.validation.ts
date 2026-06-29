import { z } from "zod";

export const prDetailSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price: z.number().min(0, "Price cannot be negative").default(0),
});

export const createPurchaseRequestSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID").optional().nullable().or(z.literal("")),
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  description: z.string().optional().or(z.literal("")),
  details: z.array(prDetailSchema)
    .min(1, "At least 1 item is required")
    .refine((items) => {
      const itemIds = items.map(i => i.itemId).filter(id => id);
      return new Set(itemIds).size === itemIds.length;
    }, { message: "Duplicate items are not allowed", path: ["root"] }),
});

export const updatePurchaseRequestSchema = createPurchaseRequestSchema.partial();

export const patchPRStatusSchema = z.object({
  status: z.number().int().min(0).max(4),
});

export const prListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  status: z.coerce.number().int().min(0).max(4).optional(),
  warehouseId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

export function parseCreatePRInput(body: unknown) {
  const parsed = createPurchaseRequestSchema.safeParse(body);
  if (parsed.success && parsed.data.customerId === "") {
    parsed.data.customerId = null;
  }
  return parsed;
}

export function parseUpdatePRInput(body: unknown) {
  const parsed = updatePurchaseRequestSchema.safeParse(body);
  if (parsed.success && parsed.data.customerId === "") {
    parsed.data.customerId = null;
  }
  return parsed;
}

export function parsePatchPRStatus(body: unknown) {
  return patchPRStatusSchema.safeParse(body);
}

export function parsePRListQuery(query: unknown) {
  return prListQuerySchema.safeParse(query);
}

export type CreatePRInput = z.infer<typeof createPurchaseRequestSchema>;
export type UpdatePRInput = z.infer<typeof updatePurchaseRequestSchema>;
export type PRListQuery = z.infer<typeof prListQuerySchema>;
export type PatchPRStatusInput = z.infer<typeof patchPRStatusSchema>;
