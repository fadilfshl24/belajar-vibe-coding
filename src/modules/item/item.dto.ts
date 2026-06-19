import type { ItemRecord, ItemPackageDetailRecord } from "./item.schema";

export interface ItemPackageDetailDTO {
  id: string;
  packageItemId: string;
  childItemId: string;
  quantity: string;
  isActive: boolean;
  price: string;
  discountPercentage: string;
  discountPrice: string;
  priceAfterDiscount: string;
}

export interface ItemDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  uomId: string;
  categoryId: string;
  barcodeText: string | null;
  barcodeType: string | null;
  imageUrl: string | null;
  itemType: "single" | "package";
  purchasePrice: string;
  sellingPrice: string;
  discountPercentage: string;
  discountPrice: string;
  priceAfterDiscount: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  category?: { id: string; name: string } | null;
  uom?: { id: string; name: string } | null;
  details?: ItemPackageDetailDTO[];
}

export function toItemDTO(
  record: ItemRecord,
  details?: ItemPackageDetailRecord[],
  category?: { id: string; name: string } | null,
  uom?: { id: string; name: string } | null
): ItemDTO {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description ?? null,
    uomId: record.uomId,
    categoryId: record.categoryId,
    barcodeText: record.barcodeText ?? null,
    barcodeType: record.barcodeType ?? null,
    imageUrl: record.imageUrl ?? null,
    itemType: record.itemType,
    purchasePrice: record.purchasePrice,
    sellingPrice: record.sellingPrice,
    discountPercentage: record.discountPercentage,
    discountPrice: record.discountPrice,
    priceAfterDiscount: record.priceAfterDiscount,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
    ...(category ? { category } : {}),
    ...(uom ? { uom } : {}),
    ...(details
      ? {
          details: details.map((d) => ({
            id: d.id,
            packageItemId: d.packageItemId,
            childItemId: d.childItemId,
            quantity: d.quantity,
            isActive: d.isActive,
            price: d.price,
            discountPercentage: d.discountPercentage,
            discountPrice: d.discountPrice,
            priceAfterDiscount: d.priceAfterDiscount,
          })),
        }
      : {}),
  };
}