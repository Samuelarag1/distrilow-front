import { apiFetch } from "./client";

export type Product = {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  costPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  marginPercent?: number;
  isActive: boolean;
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

    return apiFetch<Product[]>(`/products?${query.toString()}`);
  },

  search: (q: string) =>
    apiFetch<Product[]>(`/products?q=${encodeURIComponent(q)}`),

  getById: (id: string) => apiFetch<Product>(`/products/${id}`),

  getByBarcode: (code: string) =>
    apiFetch<Product>(`/products/barcode/${code}`),

  create: (data: Partial<Product>) =>
    apiFetch<Product>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Product>) =>
    apiFetch<Product>(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    apiFetch<void>(`/products/${id}`, {
      method: "DELETE",
    }),
};
