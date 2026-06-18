export interface JwtPayload {
  /** User UUID */
  sub: string;
  /** User email */
  email: string;
  /** Issued At (unix timestamp) */
  iat?: number;
  /** Expires At (unix timestamp) */
  exp?: number;
}
