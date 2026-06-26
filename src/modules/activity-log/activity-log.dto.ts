import type { ActivityLogRecord } from "./activity-log.schema";

export interface ActivityLogDTO {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  module: string | null;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export function toActivityLogDTO(record: ActivityLogRecord): ActivityLogDTO {
  return {
    id: record.id,
    userId: record.userId ?? null,
    username: record.username ?? null,
    action: record.action,
    module: record.module ?? null,
    description: record.description,
    ipAddress: record.ipAddress ?? null,
    userAgent: record.userAgent ?? null,
    createdAt: record.createdAt,
  };
}
