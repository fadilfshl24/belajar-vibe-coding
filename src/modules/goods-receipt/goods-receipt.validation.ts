import { z } from "zod";

export const goodsReceiptDetailSchema = z.object({
  purchaseOrderDetailId: z.string().uuid("Invalid PO detail ID"),
  itemId: z.string().uuid("Invalid item ID"),
  receivedQuantity: z.number().int().min(1, "Received quantity must be at least 1"),
  remark: z.string().optional().nullable().or(z.literal("")),
});

export const createGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().uuid("Invalid PO ID"),
  vendorId: z.string().uuid("Invalid vendor ID"),
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  receiptDate: z.string(),
  deliveryNoteNumber: z.string().optional().nullable().or(z.literal("")),
  description: z.string().optional().nullable().or(z.literal("")),
  details: z.array(goodsReceiptDetailSchema).min(1, "At least 1 item must be received"),
});

export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;

export const goodsReceiptListQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  search: z.string().optional(),
  filterColumn: z.string().optional(),
  status: z.string().regex(/^\d+$/).transform(Number).optional(),
  orderBy: z.string().default("updated_at:desc"),
  warehouseId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
});
