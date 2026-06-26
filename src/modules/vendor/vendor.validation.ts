import { z } from "zod";

export const createVendorSchema = z.object({
  code: z.string().min(1, "Code is required").max(100).toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  province: z.string().max(100).optional().or(z.literal("")),
  cityRegency: z.string().max(100).optional().or(z.literal("")),
  district: z.string().max(100).optional().or(z.literal("")),
  village: z.string().max(100).optional().or(z.literal("")),
  zipCode: z.string().max(20).optional().or(z.literal("")),
  image: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

export const updateVendorSchema = createVendorSchema.partial();

export const vendorListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  isActive: z.string().optional().transform(val => val === "true" ? true : val === "false" ? false : undefined),
});

export function parseCreateVendorInput(body: unknown) {
  return createVendorSchema.safeParse(body);
}

export function parseUpdateVendorInput(body: unknown) {
  return updateVendorSchema.safeParse(body);
}

export function parseVendorListQuery(query: unknown) {
  return vendorListQuerySchema.safeParse(query);
}

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type VendorListQuery = z.infer<typeof vendorListQuerySchema>;
