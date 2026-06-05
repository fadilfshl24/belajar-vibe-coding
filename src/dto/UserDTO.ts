import type { UserRecord } from "../models/UserModel";

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  status: number;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Map a full UserRecord to a safe UserDTO (strips the password field).
 * Always use this before returning user data to clients.
 */
export function toUserDTO(user: UserRecord): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
