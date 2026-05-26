import { backendApi } from "./backend-api";
import { getApiSession } from "./api-client";
import type {
  MeasurementType,
  Product as ApiProduct,
  ProductsQuery,
  UpdateProductRequest,
} from "./api-types";

export type Product = ApiProduct & {
  stock: number;
  minStock?: number;
  maxStock?: number;
  price: number;
  category: string;
  unit?: string;
};

function extractProductStock(value: unknown) {
  const direct = Number(value);
  if (Number.isFinite(direct)) {
    return direct;
  }

  if (!value || typeof value !== "object") {
    return 0;
  }

  const source = value as {
    quantity?: unknown;
    availableQuantity?: unknown;
    baseQuantity?: unknown;
  };

  const nestedStock = Number(
    source.quantity ?? source.availableQuantity ?? source.baseQuantity ?? 0
  );

  return Number.isFinite(nestedStock) ? nestedStock : 0;
}

function normalizeProduct(item: ApiProduct): Product {
  const measurement = item.measurementType as MeasurementType;
  return {
    ...item,
    isWeighable:
      item.isWeighable ??
      (item.measurementType === "kg" || item.measurementType === "gram"),
    stock: extractProductStock(item.stock),
    price: Number(item.retailPrice ?? item.costPrice ?? 0),
    category: item.categoryId ?? "Sin categoria",
    unit: measurement,
  };
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePluCode(value: unknown) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  return /^\d{5}$/.test(normalized) ? normalized : undefined;
}

function normalizePositiveNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

async function attachStock(item: ApiProduct): Promise<Product> {
  const { branchId } = getApiSession();
  if (!branchId) return normalizeProduct(item);

  try {
    const stock = await backendApi.stocks.getByBranchAndProduct(branchId, item.id);
    return normalizeProduct({
      ...item,
      stock: Number(stock.quantity ?? 0),
      branchId,
    });
  } catch {
    return normalizeProduct(item);
  }
}

export const productsApi = {
  getAll: async (params: ProductsQuery = {}) => {
    const page = await backendApi.productsWithStock(params);
    return page.items.map(normalizeProduct);
  },

  search: async (q: string) => {
    const normalizedQuery = q.trim();
    const page = await backendApi.productsWithStock({
      name: normalizedQuery,
      q: normalizedQuery,
      search: normalizedQuery,
      take: 20,
      skip: 0,
    });
    return page.items.map(normalizeProduct);
  },

  getById: async (id: string) => {
    const item = await backendApi.products.getById(id);
    return attachStock(item);
  },

  getByBarcode: async (code: string) => {
    const item = await backendApi.productByBarcodeWithStock(code);
    return normalizeProduct(item);
  },

  create: async (data: Partial<Product>) => {
    const { branchId } = getApiSession();
    const created = await backendApi.products.create({
      sku: String(data.sku ?? ""),
      name: String(data.name ?? ""),
      costPrice: Number(data.costPrice ?? 0),
      wholesalePrice: Number(data.wholesalePrice ?? 0),
      retailPrice: Number(data.retailPrice ?? 0),
      measurementType: (data.measurementType ?? "unit") as MeasurementType,
      barcode: normalizeOptionalString(data.barcode),
      pluCode: normalizePluCode(data.pluCode),
      isWeighable: data.isWeighable ?? undefined,
      description: normalizeOptionalString(data.description),
      wholesaleMinQuantity: normalizePositiveNumber(data.wholesaleMinQuantity),
      marginPercent: data.marginPercent ?? undefined,
      isActive: data.isActive ?? true,
      categoryId: normalizeOptionalString(data.categoryId),
      // branchId: (data.branchId ?? branchId ?? undefined) as string | undefined,
      brand: normalizeOptionalString(data.brand),
      trackStock: true,
      stockBaseProductId: normalizeOptionalString(data.stockBaseProductId),
      stockConsumptionQuantity: normalizePositiveNumber(
        data.stockConsumptionQuantity
      ),
      stockBaseUnit: (data.stockBaseUnit ?? undefined) as
        | MeasurementType
        | undefined,
      allowNegativeStock: data.allowNegativeStock ?? false,
      imageUrl: normalizeOptionalString(data.imageUrl),
    });

    return normalizeProduct(created);
  },

  update: async (id: string, data: Partial<Product>) => {
    const payload: UpdateProductRequest = {
      sku: data.sku,
      name: data.name,
      costPrice: data.costPrice,
      wholesalePrice: data.wholesalePrice,
      retailPrice: data.retailPrice,
      barcode: normalizeOptionalString(data.barcode),
      pluCode: normalizePluCode(data.pluCode),
      isWeighable: data.isWeighable,
      description: normalizeOptionalString(data.description),
      wholesaleMinQuantity: normalizePositiveNumber(data.wholesaleMinQuantity),
      marginPercent: data.marginPercent ?? undefined,
      isActive: data.isActive,
      categoryId: normalizeOptionalString(data.categoryId),
      // branchId: data.branchId ?? undefined,
      brand: normalizeOptionalString(data.brand),
      trackStock: true,
      stockBaseProductId: normalizeOptionalString(data.stockBaseProductId),
      stockConsumptionQuantity: normalizePositiveNumber(
        data.stockConsumptionQuantity
      ),
      stockBaseUnit: (data.stockBaseUnit ?? undefined) as
        | MeasurementType
        | undefined,
      allowNegativeStock: data.allowNegativeStock,
      imageUrl: normalizeOptionalString(data.imageUrl),
      measurementType: data.measurementType as MeasurementType | undefined,
    };
    const updated = await backendApi.products.update(id, payload);
    return updated ? normalizeProduct(updated) : null;
  },

  remove: (id: string) => backendApi.products.remove(id),
};
