export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Input data not found or invalid!" };
  }

  const { email, password } = body as Record<string, unknown>;

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return { valid: false, error: "Field 'email' must be a valid email address" };
  }

  // Intentionally no max-length check on password — let bcrypt.compare handle wrong passwords
  if (!password || typeof password !== "string" || password.length < 1) {
    return { valid: false, error: "Field 'password' is required" };
  }

  return { valid: true };
}

export function validateRefreshTokenInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Input data not found or invalid!" };
  }

  const { refreshToken } = body as Record<string, unknown>;

  if (!refreshToken || typeof refreshToken !== "string" || refreshToken.trim().length === 0) {
    return { valid: false, error: "Field 'refreshToken' is required" };
  }

  return { valid: true };
}
