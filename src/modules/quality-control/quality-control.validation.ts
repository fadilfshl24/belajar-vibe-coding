import { z } from "zod";

export const qualityControlDetailSchema = z.object({
  goodsReceiptDetailId: z.string().uuid("Invalid GR detail ID"),
  itemId: z.string().uuid("Invalid item ID"),
  passQuantity: z.number().int().min(0, "Pass quantity cannot be negative"),
  rejectQuantity: z.number().int().min(0, "Reject quantity cannot be negative"),
  rejectReason: z.string().optional().nullable().or(z.literal("")),
}).refine((data) => {
  if (data.rejectQuantity > 0) {
    return data.rejectReason && data.rejectReason.trim().length > 0;
  }
  return true;
}, {
  message: "Reject reason is required when reject quantity is greater than 0",
  path: ["rejectReason"],
});

export const createQualityControlSchema = z.object({
  goodsReceiptId: z.string().uuid("Invalid Goods Receipt ID"),
  inspectionDate: z.string(),
  notes: z.string().optional().nullable().or(z.literal("")),
  details: z.array(qualityControlDetailSchema).min(1, "At least 1 item must be inspected"),
});

export type CreateQualityControlInput = z.infer<typeof createQualityControlSchema>;

export const approveQualityControlSchema = z.object({
  remark: z.string().optional().nullable().or(z.literal("")),
});

export type ApproveQualityControlInput = z.infer<typeof approveQualityControlSchema>;

export const qualityControlListQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  search: z.string().optional(),
  filterColumn: z.string().optional(),
  status: z.string().regex(/^\d+$/).transform(Number).optional(),
  orderBy: z.string().default("updated_at:desc"),
});
