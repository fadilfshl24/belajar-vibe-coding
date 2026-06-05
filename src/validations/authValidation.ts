import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// Zod v4: use `error` instead of `required_error`/`invalid_type_error`
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  email: z
    .string({ error: "Field 'email' is required" })
    .email("Field 'email' must be a valid email address"),

  // No max-length check intentionally — let bcrypt.compare handle wrong passwords
  password: z
    .string({ error: "Field 'password' is required" })
    .min(1, "Field 'password' is required"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z
    .string({ error: "Field 'refreshToken' is required" })
    .trim()
    .min(1, "Field 'refreshToken' is required"),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// ---------------------------------------------------------------------------
// Validator helpers
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateLoginInput(body: unknown): ValidationResult {
  const result = LoginSchema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    return { valid: false, error: first?.message ?? "Input data not found or invalid!" };
  }
  return { valid: true };
}

export function validateRefreshTokenInput(body: unknown): ValidationResult {
  const result = RefreshTokenSchema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    return { valid: false, error: first?.message ?? "Input data not found or invalid!" };
  }
  return { valid: true };
}

/**
 * Parse and return typed data directly.
 */
export function parseLoginInput(body: unknown) {
  return LoginSchema.safeParse(body);
}

export function parseRefreshTokenInput(body: unknown) {
  return RefreshTokenSchema.safeParse(body);
}
