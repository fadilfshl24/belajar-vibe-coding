import type { UserRecord } from "./user.schema";

/**
 * UserDTO
 *
 * Data Transfer Object untuk user — field sensitif (password) dikecualikan.
 * Gunakan tipe ini untuk semua response API yang mengandung data user.
 */
export interface UserDTO {
  id: string;
  name: string;
  email: string;
  status: number;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Mengonversi UserRecord (dari DB) ke UserDTO (aman untuk dikirim ke client).
 */
export function toUserDTO(record: UserRecord): UserDTO {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}
