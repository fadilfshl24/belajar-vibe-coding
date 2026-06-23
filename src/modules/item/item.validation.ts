import { z } from "zod";

const packageDetailSchema = z.object({
  childItemId: z.string().uuid("Invalid child item UUID"),
  quantity: z.number().positive("Quantity must be positive").default(1),
  price: z.number().min(0, "Price cannot be negative").default(0),
  discountPercentage: z.number().min(0).max(100, "Discount cannot exceed 100%").default(0),
});

export const createItemSchema = z
  .object({
    code: z.string().min(1, "Code is required").max(100).toUpperCase(),
    name: z.string().min(2, "Name must be at least 2 characters").max(255),
    description: z.string().max(2000).optional(),
    uomId: z.string().uuid("Invalid UOM UUID"),
    categoryId: z.string().uuid("Invalid category UUID"),
    barcodeText: z.string().max(150).optional(),
    barcodeType: z.string().max(50).optional(),
    imageUrl: z.string().url("Invalid URL format").optional().or(z.literal("")),
    itemType: z.enum(["single", "package"]).default("single"),
    purchasePrice: z.number().min(0, "Purchase price cannot be negative").default(0),
    sellingPrice: z.number().min(0, "Selling price cannot be negative").default(0),
    isActive: z.boolean().optional().default(true),
    discountPercentage: z.number().min(0).max(100).optional().default(0),
    details: z.array(packageDetailSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.itemType === "package") {
      if (!data.details || data.details.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["details"],
          message: "Package details are required for package item",
        });
      }
    }
  });

export const updateItemSchema = z
  .object({
    code: z.string().min(1).max(100).toUpperCase().optional(),
    name: z.string().min(2).max(255).optional(),
    description: z.string().max(2000).optional(),
    uomId: z.string().uuid("Invalid UOM UUID").optional(),
    categoryId: z.string().uuid("Invalid category UUID").optional(),
    barcodeText: z.string().max(150).optional().nullable(),
    barcodeType: z.string().max(50).optional().nullable(),
    imageUrl: z.string().url("Invalid URL format").optional().or(z.literal("")).nullable(),
    itemType: z.enum(["single", "package"]).optional(),
    purchasePrice: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
    discountPercentage: z.number().min(0).max(100).optional(),
    details: z.array(packageDetailSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.itemType === "package") {
      if (!data.details || data.details.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["details"],
          message: "Package details are required for package item",
        });
      }
    }
  });

export const itemListQuerySchema = z.object({
  page: z.string().optional().transform(val => Math.max(1, parseInt(val ?? "1", 10) || 1)),
  limit: z.string().optional().transform(val => parseInt(val ?? "10", 10) || 10),
  orderBy: z.string().optional().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  itemType: z.enum(["single", "package"]).optional(),
  categoryId: z.string().uuid().optional(),
  uomId: z.string().uuid().optional(),
  isActive: z.string().optional().transform(val => val === "true" ? true : val === "false" ? false : undefined),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type PackageDetailInput = z.infer<typeof packageDetailSchema>;

export function parseCreateItemInput(data: unknown) {
  return createItemSchema.safeParse(data);
}

export function parseUpdateItemInput(data: unknown) {
  return updateItemSchema.safeParse(data);
}

export function parseItemListQuery(data: unknown) {
  return itemListQuerySchema.safeParse(data);
}