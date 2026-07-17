import { z } from "zod";

export const assemblyOrderDetailSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  quantityProduced: z.number().positive("Quantity produced must be greater than 0"),
});

export const createAssemblyOrderSchema = z.object({
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  notes: z.string().optional().nullable().or(z.literal("")),
  details: z.array(assemblyOrderDetailSchema)
    .min(1, "At least 1 item is required")
    .refine((items) => {
      const itemIds = items.map(i => i.itemId).filter(id => id);
      return new Set(itemIds).size === itemIds.length;
    }, { message: "Duplicate items are not allowed", path: ["root"] }),
});

export const assemblyOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("updated_at:desc"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  status: z.coerce.number().int().min(0).max(3).optional(),
  warehouseId: z.string().uuid().optional(),
});

export const approveAssemblyOrderSchema = z.object({
  remark: z.string().optional().nullable().or(z.literal("")),
});

export function parseCreateAssemblyOrderInput(body: unknown) {
  return createAssemblyOrderSchema.safeParse(body);
}

export function parseAssemblyOrderListQuery(query: unknown) {
  return assemblyOrderListQuerySchema.safeParse(query);
}

export function parseApproveAssemblyOrderInput(body: unknown) {
  return approveAssemblyOrderSchema.safeParse(body);
}

export type CreateAssemblyOrderInput = z.infer<typeof createAssemblyOrderSchema>;
export type AssemblyOrderListQuery = z.infer<typeof assemblyOrderListQuerySchema>;
export type ApproveAssemblyOrderInput = z.infer<typeof approveAssemblyOrderSchema>;
