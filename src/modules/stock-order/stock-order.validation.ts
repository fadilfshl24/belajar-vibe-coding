import { z } from "zod";

export const importStockOrderSchema = z.object({
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  purchaseChannel: z.enum(["TikTok", "Shopee", "Lazada", "Tokopedia", "Lainnya"]),
});

export const parseImportStockOrder = (data: unknown) => {
  return importStockOrderSchema.safeParse(data);
};

export const listStockOrderQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional().nullable().or(z.literal("")),
  warehouseId: z.string().uuid().optional().nullable().or(z.literal("")),
  paymentMethod: z.string().optional().nullable().or(z.literal("")),
  status: z.enum(["UNPACKED", "PACKED", "SENDING", "DONE", "RETURNED"]).optional().nullable().or(z.literal("")),
  type: z.enum(["INBOUND", "OUTBOUND"]).optional().nullable().or(z.literal("")),
  purchaseChannel: z.enum(["TikTok", "Shopee", "Lazada", "Tokopedia", "Lainnya"]).optional().nullable().or(z.literal("")),
});

export const parseListStockOrderQuery = (data: unknown) => {
  return listStockOrderQuerySchema.safeParse(data);
};
