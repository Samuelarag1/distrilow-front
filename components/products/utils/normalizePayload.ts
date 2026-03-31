// components/products/utils/normalizeProductPayload.ts
import { Product } from "@/lib/products";

export function normalizeProductPayload(productData: Partial<Product>) {
  const rawPlu = (productData as any).pluCode?.trim() || "";
  const normalizedPlu = /^\d{5}$/.test(rawPlu) ? rawPlu : undefined;
  const normalizedSku =
    normalizedPlu ??
    (typeof productData.sku === "string" && productData.sku.trim()
      ? productData.sku.trim()
      : undefined);
  const barcode = (productData as any).barcode?.trim() || undefined;
  const categoryId = (productData as any).categoryId?.trim() || undefined;
  const description = (productData as any).description?.trim() || undefined;
  const brand = (productData as any).brand?.trim() || undefined;
  const stockBaseProductId =
    (productData as any).stockBaseProductId?.trim() || undefined;
  const stockConsumptionRaw = Number((productData as any).stockConsumptionQuantity);
  const stockConsumptionQuantity =
    Number.isFinite(stockConsumptionRaw) && stockConsumptionRaw > 0
      ? stockConsumptionRaw
      : undefined;
  const wholesaleMinQuantityRaw = Number((productData as any).wholesaleMinQuantity);
  const wholesaleMinQuantity =
    Number.isFinite(wholesaleMinQuantityRaw) && wholesaleMinQuantityRaw > 0
      ? wholesaleMinQuantityRaw
      : undefined;
  const stockBaseUnit = (productData as any).stockBaseUnit ?? undefined;

  return {
    sku: normalizedSku,
    name: productData.name,
    barcode,
    pluCode: normalizedPlu,
    isWeighable:
      (productData as any).isWeighable === undefined
        ? undefined
        : Boolean((productData as any).isWeighable),
    description,
    wholesaleMinQuantity,
    costPrice:
      productData.costPrice !== undefined ? Number(productData.costPrice) : undefined,
    wholesalePrice:
      productData.wholesalePrice !== undefined
        ? Number(productData.wholesalePrice)
        : undefined,
    retailPrice:
      productData.retailPrice !== undefined ? Number(productData.retailPrice) : undefined,
    marginPercent:
      (productData as any).marginPercent !== undefined &&
      (productData as any).marginPercent !== null &&
      (productData as any).marginPercent !== ""
        ? Number((productData as any).marginPercent)
        : undefined,
    isActive: productData.isActive,
    categoryId,
    branchId: (productData as any).branchId ?? undefined,
    brand,
    trackStock: (productData as any).trackStock,
    stockBaseProductId,
    stockConsumptionQuantity,
    stockBaseUnit,
    allowNegativeStock: (productData as any).allowNegativeStock,
    imageUrl: (productData as any).imageUrl ?? undefined,
    measurementType: (productData as any).measurementType ?? "unit",
  };
}
