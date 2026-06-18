import { z } from "zod";

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.email("Email format is invalid"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export function parseLoginInput(body: unknown) {
  return loginSchema.safeParse(body);
}

export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Refresh Token
// ---------------------------------------------------------------------------

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export function parseRefreshTokenInput(body: unknown) {
  return refreshTokenSchema.safeParse(body);
}

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
