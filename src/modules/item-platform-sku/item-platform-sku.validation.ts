import { z } from "zod";

export const createItemPlatformSkuSchema = z.object({
  platformId: z.string().uuid("Invalid platform ID format"),
  platformSku: z.string().min(3, "Platform SKU must be at least 3 characters").max(100, "Platform SKU must be at most 100 characters").trim(),
});

export type CreateItemPlatformSkuInput = z.infer<typeof createItemPlatformSkuSchema>;

export function parseCreateItemPlatformSkuInput(data: unknown) {
  return createItemPlatformSkuSchema.safeParse(data);
}
