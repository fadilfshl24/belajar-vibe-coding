import type { ItemCategoryRecord } from "./category.schema";

export interface CategoryDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toCategoryDTO(record: ItemCategoryRecord): CategoryDTO {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description ?? null,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}
