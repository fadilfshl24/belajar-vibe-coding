import { z } from "zod";

export const scrapDetailSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  notes: z.string().optional().nullable().or(z.literal("")),
});

export const createScrapSchema = z.object({
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  type: z.enum(["IN", "OUT"]),
  reasonCategory: z.enum(["DAMAGED", "LOST", "QC_REJECT", "CUSTOMER_REFUND", "OTHER"]),
  notes: z.string().optional().nullable().or(z.literal("")),
  details: z.array(scrapDetailSchema)
    .min(1, "At least 1 item is required")
    .refine((items) => {
      const itemIds = items.map(i => i.itemId).filter(id => id);
      return new Set(itemIds).size === itemIds.length;
    }, { message: "Duplicate items are not allowed", path: ["root"] }),
});

export const updateScrapSchema = createScrapSchema.partial();

export const scrapListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("updated_at:desc"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  type: z.enum(["IN", "OUT"]).optional(),
  status: z.coerce.number().int().min(0).max(3).optional(),
  warehouseId: z.string().uuid().optional(),
});

export const approveScrapSchema = z.object({
  remark: z.string().optional().nullable().or(z.literal("")),
});

export function parseCreateScrapInput(body: unknown) {
  return createScrapSchema.safeParse(body);
}

export function parseUpdateScrapInput(body: unknown) {
  return updateScrapSchema.safeParse(body);
}

export function parseScrapListQuery(query: unknown) {
  return scrapListQuerySchema.safeParse(query);
}

export function parseApproveScrapInput(body: unknown) {
  return approveScrapSchema.safeParse(body);
}

export type CreateScrapInput = z.infer<typeof createScrapSchema>;
export type UpdateScrapInput = z.infer<typeof updateScrapSchema>;
export type ScrapListQuery = z.infer<typeof scrapListQuerySchema>;
export type ApproveScrapInput = z.infer<typeof approveScrapSchema>;
