import { z } from "zod";

export const qpDetailSchema = z.object({
  purchaseRequestDetailId: z.string().uuid("Invalid PR Detail ID"),
  itemId: z.string().uuid("Invalid Item ID"),
  vendorId: z.string().uuid("Invalid Vendor ID"),
  requestedQuantity: z.number().positive(),
  offeredQuantity: z.number().positive(),
  price: z.number().min(0),
  remark: z.string().optional(),
  attachmentUrl: z.string().url("Invalid URL format").optional().or(z.literal("")),
});

export const createQuotationPlanSchema = z.object({
  purchaseRequestIds: z.array(z.string().uuid("Invalid Purchase Request ID")).min(1, "At least one PR is required"),
  warehouseId: z.string().uuid("Invalid Warehouse ID"),
  description: z.string().optional().or(z.literal("")),
  details: z.array(qpDetailSchema).min(1, "At least one item is required"),
});

export const updateQuotationPlanSchema = createQuotationPlanSchema.partial();

export const approvalQPSchema = z.object({
  status: z.number().int().min(1).max(2), // 1 = Approved, 2 = Rejected
  notes: z.string().optional(),
});

export const qpListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  search: z.string().optional(),
  purchaseRequestId: z.string().uuid().optional(),
});

export function parseCreateQPInput(body: unknown) {
  return createQuotationPlanSchema.safeParse(body);
}

export function parseApprovalQPInput(body: unknown) {
  return approvalQPSchema.safeParse(body);
}

export function parseQPListQuery(query: unknown) {
  return qpListQuerySchema.safeParse(query);
}
