import { z } from "zod";

export const poDetailSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  purchaseRequestDetailId: z.string().uuid().optional().nullable().or(z.literal("")),
  quotationPlanDetailId: z.string().uuid().optional().nullable().or(z.literal("")),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price: z.number().min(0, "Price cannot be negative").default(0),
  remark: z.string().optional().nullable().or(z.literal("")),
  attachmentUrl: z.string().optional().nullable().or(z.literal("")),
});

export const createPurchaseOrderSchema = z.object({
  purchaseRequestIds: z.array(z.string().uuid("Invalid PR ID")).min(1, "At least 1 PR is required"),
  vendorId: z.string().uuid("Invalid vendor ID"),
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  orderDate: z.string(),
  expectedDeliveryDate: z.string().optional().nullable().or(z.literal("")),
  tax: z.number().min(0).default(0),
  discountPercentage: z.number().min(0).max(100).default(0),
  discount: z.number().min(0).default(0),
  shippingFee: z.number().min(0).default(0),
  description: z.string().optional().nullable().or(z.literal("")),
  termsConditions: z.string().optional().nullable().or(z.literal("")),
  termOfPayment: z.string().optional().nullable().or(z.literal("")),
  details: z.array(poDetailSchema).min(1, "At least 1 item is required"),
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial();

export const patchPOStatusSchema = z.object({
  status: z.number().int().min(0).max(9), // Updated max status for full flow
});

export const patchPOApprovalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  remark: z.string().optional().nullable(),
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
  status: z.coerce.number().int().min(0).max(9).optional(),
  warehouseId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
});

export function parseCreatePOInput(body: unknown) {
  const parsed = createPurchaseOrderSchema.safeParse(body);
  if (parsed.success) {
    if (parsed.data.expectedDeliveryDate === "") parsed.data.expectedDeliveryDate = undefined;
    if (parsed.data.description === "") parsed.data.description = undefined;
    if (parsed.data.termsConditions === "") parsed.data.termsConditions = undefined;
  }
  return parsed;
}

export function parseUpdatePOInput(body: unknown) {
  const parsed = updatePurchaseOrderSchema.safeParse(body);
  if (parsed.success) {
    if (parsed.data.expectedDeliveryDate === "") parsed.data.expectedDeliveryDate = undefined;
    if (parsed.data.description === "") parsed.data.description = undefined;
    if (parsed.data.termsConditions === "") parsed.data.termsConditions = undefined;
  }
  return parsed;
}

export function parsePatchPOStatus(body: unknown) {
  return patchPOStatusSchema.safeParse(body);
}

export function parsePatchPOApproval(body: unknown) {
  return patchPOApprovalSchema.safeParse(body);
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
export type PatchPOApprovalInput = z.infer<typeof patchPOApprovalSchema>;
export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;
