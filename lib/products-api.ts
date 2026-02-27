// src/lib/products-api.ts
import { apiClientFetch } from "@/lib/api-client";

export type Product = {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  stock: number;
  minStock?: number;
  maxStock?: number;
  price: number;
  category: string;
  unit?: string;
  branchId?: string;
  costPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  marginPercent?: number;
  isActive?: boolean;
  categoryId?: string;
  measurementType: string;
  brand?: string;
  trackStock: boolean;
  allowNegativeStock: boolean;
  createdAt: string;
  updatedAt: string;
};

export const productsApi = {
  getAll: (params?: { skip?: number; take?: number }) => {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 10),
    });

    return apiClientFetch.get<Product[]>(`/products?${query.toString()}`);
  },

  search: (q: string) =>
    apiClientFetch.get<Product[]>(`/products?q=${encodeURIComponent(q)}`),

  getById: (id: string) => apiClientFetch.get<Product>(`/products/${id}`),

  getByBarcode: (code: string) =>
    apiClientFetch.get<Product>(`/products/barcode/${code}`),

  create: (data: Partial<Product>) =>
    apiClientFetch.post<Product>("/products", data),

  update: (id: string, data: Partial<Product>) =>
    apiClientFetch.patch<Product>(`/products/${id}`, data),

  remove: (id: string) => apiClientFetch.delete<void>(`/products/${id}`),
};
