import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// Zod v4: use `error` instead of `required_error`/`invalid_type_error`
// ---------------------------------------------------------------------------

export const RegisterSchema = z.object({
  name: z
    .string({ error: "Field 'name' is required" })
    .trim()
    .min(1, "Field 'name' is required")
    .max(255, "Field 'name' must not exceed 255 characters"),

  email: z
    .string({ error: "Field 'email' is required" })
    .email("Field 'email' must be a valid email address")
    .max(255, "Field 'email' must not exceed 255 characters"),

  password: z
    .string({ error: "Field 'password' is required" })
    .min(8, "Field 'password' must be at least 8 characters")
    // bcrypt processes at most 72 bytes
    .max(72, "Field 'password' must not exceed 72 characters"),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type RegisterInput = z.infer<typeof RegisterSchema>;

// ---------------------------------------------------------------------------
// Validator helpers
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRegisterInput(body: unknown): ValidationResult {
  const result = RegisterSchema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    return { valid: false, error: first?.message ?? "Input data not found or invalid!" };
  }
  return { valid: true };
}

/**
 * Parse and return typed data directly.
 * Use when you want the validated + coerced value instead of just valid/error.
 */
export function parseRegisterInput(body: unknown) {
  return RegisterSchema.safeParse(body);
}
