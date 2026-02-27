// components/products/utils/normalizeProductPayload.ts
import { Product } from "@/lib/products";

export function normalizeProductPayload(productData: Partial<Product>) {
  const payload: any = {
    ...productData,

    measurementType: (productData as any).measurementType ?? "unit",

    barcode: (productData as any).barcode?.trim() || null,
    categoryId: (productData as any).categoryId?.trim() || null,

    costPrice:
      productData.costPrice !== undefined
        ? Number(productData.costPrice)
        : undefined,
    wholesalePrice:
      productData.wholesalePrice !== undefined
        ? Number(productData.wholesalePrice)
        : undefined,
    retailPrice:
      productData.retailPrice !== undefined
        ? Number(productData.retailPrice)
        : undefined,
    marginPercent:
      (productData as any).marginPercent !== undefined &&
      (productData as any).marginPercent !== null &&
      (productData as any).marginPercent !== ""
        ? Number((productData as any).marginPercent)
        : undefined,
  };

  return payload;
}
