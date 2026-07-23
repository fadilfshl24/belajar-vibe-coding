import { z } from "zod";

// ─────────────────────────────────────────────
// Import Excel
// ─────────────────────────────────────────────
export const importStockOrderSchema = z.object({
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  purchaseChannel: z.enum(["TikTok", "Shopee", "Lazada", "Tokopedia", "Lainnya"]),
});

export const parseImportStockOrder = (data: unknown) => {
  return importStockOrderSchema.safeParse(data);
};

// ─────────────────────────────────────────────
// List Query
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Pack With Mapping (Outbound)
// ─────────────────────────────────────────────
const mappedItemSchema = z.object({
  itemId: z.string().uuid("itemId harus berupa UUID yang valid"),
  quantity: z.number({ invalid_type_error: "quantity harus berupa angka" }).positive("quantity harus lebih dari 0"),
  isAutoRestockIfReturn: z.boolean({ invalid_type_error: "isAutoRestockIfReturn harus berupa boolean" }),
});

export const packWithMappingSchema = z.object({
  remark: z.string().max(1000).optional().nullable(),
  mappedItems: z
    .array(mappedItemSchema)
    .min(1, "Minimal harus ada 1 item yang di-mapping untuk packing"),
});

export type PackWithMappingPayload = z.infer<typeof packWithMappingSchema>;

export const parsePackWithMapping = (data: unknown) => {
  return packWithMappingSchema.safeParse(data);
};

// ─────────────────────────────────────────────
// Process Return (Inbound)
// ─────────────────────────────────────────────
const returnItemSchema = z.object({
  /** null = produk asing / bukan produk kita */
  itemId: z.string().uuid("itemId harus UUID").nullable().optional(),
  /** Wajib diisi, termasuk untuk produk asing */
  itemNameSnapshot: z.string().min(1, "Nama item tidak boleh kosong").max(255),
  returnedQuantity: z
    .number({ invalid_type_error: "returnedQuantity harus berupa angka" })
    .positive("returnedQuantity harus lebih dari 0"),
  notes: z.string().max(1000).optional().nullable(),
});

export const processReturnSchema = z.object({
  returnReason: z.string().max(1000).optional().nullable(),
  /** URL hasil upload foto bukti — WAJIB */
  proofImageUrl: z.string().min(1, "Foto bukti retur wajib diisi").url("proofImageUrl harus berupa URL yang valid"),
  returnItems: z
    .array(returnItemSchema)
    .min(1, "Minimal harus ada 1 item yang direturn"),
});

export type ProcessReturnPayload = z.infer<typeof processReturnSchema>;

export const parseProcessReturn = (data: unknown) => {
  return processReturnSchema.safeParse(data);
};
