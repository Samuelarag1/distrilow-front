// components/products/types/products.ts
import { Product } from "@/lib/products";

export type SortKey = "name" | "price" | "stock" | "category";
export type SortOrder = "asc" | "desc";

// backend soporta estos (según lo que armamos)
export type ApiSortBy =
  | "name"
  | "createdAt"
  | "costPrice"
  | "retailPrice"
  | "wholesalePrice";

export type PageResponse = {
  items: Product[];
  total: number;
  skip: number;
  take: number;
  nextSkip: number | null;
  hasMore: boolean;
};
