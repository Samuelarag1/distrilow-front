import type { Product } from "@/lib/products";

const URL_REGEX = /^https?:\/\//i;

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function resolveProductImageUrl(
  product?: Pick<Product, "imageUrl" | "brand"> | null
) {
  const imageUrl = normalizeText(product?.imageUrl);
  if (imageUrl) return imageUrl;

  // Backward compatibility: registros viejos pudieron guardar una URL en brand.
  const legacyBrandImage = normalizeText(product?.brand);
  if (legacyBrandImage && URL_REGEX.test(legacyBrandImage)) {
    return legacyBrandImage;
  }

  return "/placeholder.svg";
}
