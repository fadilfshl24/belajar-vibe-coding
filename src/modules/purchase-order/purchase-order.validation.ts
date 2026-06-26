import { z } from "zod";

export const poDetailSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price: z.number().min(0, "Price cannot be negative").default(0),
});

export const createPurchaseOrderSchema = z.object({
  purchaseRequestId: z.string().uuid("Invalid PR ID").optional().nullable().or(z.literal("")),
  vendorId: z.string().uuid("Invalid vendor ID"),
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  orderDate: z.string(),
  expectedDeliveryDate: z.string().optional().or(z.literal("")),
  tax: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  shippingFee: z.number().min(0).default(0),
  description: z.string().optional().or(z.literal("")),
  details: z.array(poDetailSchema).min(1, "At least 1 item is required"),
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial();

export const patchPOStatusSchema = z.object({
  status: z.number().int().min(0).max(4),
});

export const receiveGoodsItemSchema = z.object({
  detailId: z.string().uuid(),
  receivedQuantity: z.number().int().min(1, "Received quantity must be at least 1"),
});

export const receiveGoodsSchema = z.object({
  items: z.array(receiveGoodsItemSchema).min(1, "At least 1 item is required to receive"),
});

export const poListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  status: z.coerce.number().int().min(0).max(4).optional(),
  warehouseId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
});

export function parseCreatePOInput(body: unknown) {
  const parsed = createPurchaseOrderSchema.safeParse(body);
  if (parsed.success) {
    if (parsed.data.purchaseRequestId === "") parsed.data.purchaseRequestId = null;
    if (parsed.data.expectedDeliveryDate === "") parsed.data.expectedDeliveryDate = undefined;
  }
  return parsed;
}

export function parseUpdatePOInput(body: unknown) {
  const parsed = updatePurchaseOrderSchema.safeParse(body);
  if (parsed.success) {
    if (parsed.data.purchaseRequestId === "") parsed.data.purchaseRequestId = null;
    if (parsed.data.expectedDeliveryDate === "") parsed.data.expectedDeliveryDate = undefined;
  }
  return parsed;
}

export function parsePatchPOStatus(body: unknown) {
  return patchPOStatusSchema.safeParse(body);
}

export function parseReceiveGoodsInput(body: unknown) {
  return receiveGoodsSchema.safeParse(body);
}

export function parsePOListQuery(query: unknown) {
  return poListQuerySchema.safeParse(query);
}

export type CreatePOInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePOInput = z.infer<typeof updatePurchaseOrderSchema>;
export type POListQuery = z.infer<typeof poListQuerySchema>;
export type PatchPOStatusInput = z.infer<typeof patchPOStatusSchema>;
export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;
