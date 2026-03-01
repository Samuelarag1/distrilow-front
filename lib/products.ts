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

function normalizeProduct(item: ApiProduct): Product {
  const measurement = item.measurementType as MeasurementType;
  return {
    ...item,
    stock: Number(item.stock ?? 0),
    price: Number(item.retailPrice ?? item.costPrice ?? 0),
    category: item.categoryId ?? "Sin categoria",
    unit: measurement,
  };
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
    const page = await backendApi.productsWithStock({
      name: q,
      q,
      search: q,
      take: 30,
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
      barcode: data.barcode ?? undefined,
      description: data.description ?? undefined,
      marginPercent: data.marginPercent ?? undefined,
      isActive: data.isActive ?? true,
      categoryId: data.categoryId ?? undefined,
      branchId: (data.branchId ?? branchId ?? undefined) as string | undefined,
      brand: data.brand ?? undefined,
      trackStock: data.trackStock ?? true,
      allowNegativeStock: data.allowNegativeStock ?? false,
      imageUrl: data.imageUrl ?? undefined,
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
      barcode: data.barcode ?? undefined,
      description: data.description ?? undefined,
      marginPercent: data.marginPercent ?? undefined,
      isActive: data.isActive,
      categoryId: data.categoryId ?? undefined,
      branchId: data.branchId ?? undefined,
      brand: data.brand ?? undefined,
      trackStock: data.trackStock,
      allowNegativeStock: data.allowNegativeStock,
      imageUrl: data.imageUrl ?? undefined,
      measurementType: data.measurementType as MeasurementType | undefined,
    };
    const updated = await backendApi.products.update(id, payload);
    return updated ? normalizeProduct(updated) : null;
  },

  remove: (id: string) => backendApi.products.remove(id),
};
