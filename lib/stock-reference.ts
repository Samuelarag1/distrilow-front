import { backendApi } from "@/lib/backend-api";
import type { Stock } from "@/lib/api-types";

export type StockReference = {
  stockProductId: string;
  quantity: number;
  baseQuantity: number;
  raw: Stock | null;
};

function toFinite(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Resolves the real stock owner product id for a product in a branch.
 * Falls back to the same product id when the stock row is unavailable.
 */
export async function resolveStockReference(
  productId: string,
  branchId: string,
  options?: { strict?: boolean }
): Promise<StockReference> {
  const normalizedProductId = String(productId ?? "").trim();
  const normalizedBranchId = String(branchId ?? "").trim();
  if (!normalizedProductId) {
    throw new Error("Producto invalido para resolver referencia de stock.");
  }
  if (!normalizedBranchId) {
    throw new Error("Sucursal invalida para resolver referencia de stock.");
  }

  try {
    const stock = (await backendApi.stocks.getByBranchAndProduct(
      normalizedBranchId,
      normalizedProductId
    )) as Stock & {
      stockProductId?: unknown;
      baseQuantity?: unknown;
    };

    const stockProductId = String(
      stock.stockProductId ?? stock.productId ?? normalizedProductId
    ).trim();

    return {
      stockProductId: stockProductId || normalizedProductId,
      quantity: toFinite(stock.quantity, 0),
      baseQuantity: toFinite(stock.baseQuantity ?? stock.quantity, 0),
      raw: stock,
    };
  } catch (error) {
    if (options?.strict) {
      throw error;
    }
    return {
      stockProductId: normalizedProductId,
      quantity: 0,
      baseQuantity: 0,
      raw: null,
    };
  }
}
