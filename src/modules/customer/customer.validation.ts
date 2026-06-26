import { z } from "zod";

export const createCustomerSchema = z.object({
  code: z.string().min(1, "Code is required").max(100).toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  type: z.enum(["company", "personal"]).default("company"),
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

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  orderBy: z.string().default("{'CreatedAt':'DESC'}"),
  searchTerm: z.string().optional(),
  filterColumn: z.string().optional(),
  isActive: z.string().optional().transform(val => val === "true" ? true : val === "false" ? false : undefined),
  type: z.enum(["company", "personal"]).optional(),
});

export function parseCreateCustomerInput(body: unknown) {
  return createCustomerSchema.safeParse(body);
}

export function parseUpdateCustomerInput(body: unknown) {
  return updateCustomerSchema.safeParse(body);
}

export function parseCustomerListQuery(query: unknown) {
  return customerListQuerySchema.safeParse(query);
}

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
