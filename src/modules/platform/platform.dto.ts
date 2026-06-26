import type { PlatformRecord } from "./platform.schema";

export type PlatformDTO = Omit<PlatformRecord, "deletedAt">;

export function toPlatformDTO(record: PlatformRecord): PlatformDTO {
  const { deletedAt, ...dto } = record;
  return dto;
}
