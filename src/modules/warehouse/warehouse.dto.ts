import type { WarehouseRecord, WarehouseHeadRecord } from "./warehouse.schema";

export interface WarehouseDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  province: string | null;
  cityRegency: string | null;
  district: string | null;
  village: string | null;
  zipCode: string | null;
  latitude: string | null;
  longitude: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface WarehouseHeadDTO {
  id: string;
  warehouseId: string;
  userId: string;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toWarehouseDTO(record: WarehouseRecord): WarehouseDTO {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description ?? null,
    address: record.address ?? null,
    province: record.province ?? null,
    cityRegency: record.cityRegency ?? null,
    district: record.district ?? null,
    village: record.village ?? null,
    zipCode: record.zipCode ?? null,
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}

export function toWarehouseHeadDTO(record: WarehouseHeadRecord): WarehouseHeadDTO {
  return {
    id: record.id,
    warehouseId: record.warehouseId,
    userId: record.userId,
    isActive: record.isActive,
    description: record.description ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}
