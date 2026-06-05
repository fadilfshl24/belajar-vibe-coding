export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Input data not found or invalid!" };
  }

  const { name, email, password } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { valid: false, error: "Field 'name' is required" };
  }
  if (name.trim().length > 255) {
    return { valid: false, error: "Field 'name' must not exceed 255 characters" };
  }

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return { valid: false, error: "Field 'email' must be a valid email address" };
  }
  if (email.length > 255) {
    return { valid: false, error: "Field 'email' must not exceed 255 characters" };
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return { valid: false, error: "Field 'password' must be at least 8 characters" };
  }
  // bcrypt processes at most 72 bytes
  if (password.length > 72) {
    return { valid: false, error: "Field 'password' must not exceed 72 characters" };
  }

  return { valid: true };
}
