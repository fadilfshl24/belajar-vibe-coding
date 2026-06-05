export interface JwtPayload {
  sub: string;    // user UUID
  email: string;
  iat?: number;   // issued at — set automatically by jsonwebtoken
  exp?: number;   // expiry   — set automatically by jsonwebtoken
}
