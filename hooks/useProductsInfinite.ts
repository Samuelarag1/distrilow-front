// hooks/useProductsInfinite.ts
"use client";

import useSWRInfinite from "swr/infinite";
import { bffGet } from "@/lib/bff-client";
import type { Product } from "@/lib/products";

type SortBy =
  | "name"
  | "createdAt"
  | "costPrice"
  | "retailPrice"
  | "wholesalePrice";
type SortOrder = "asc" | "desc";

type PageResponse = {
  items: Product[];
  total: number;
  skip: number;
  take: number;
  nextSkip: number | null;
  hasMore: boolean;
};

type Args = {
  take?: number;
  branchId: string | null; // para construir key; el header lo manda tu client
  search?: string;
  categoryId?: string | null;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
};

function buildQuery(params: Record<string, any>) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || v === "all") return;
    usp.set(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export function useProductsInfinite({
  take = 20,
  branchId,
  search,
  categoryId,
  sortBy = "name",
  sortOrder = "asc",
}: Args) {
  const getKey = (pageIndex: number, previousPageData: PageResponse | null) => {
    if (!branchId) return null; // no branch => no request
    if (previousPageData && !previousPageData.hasMore) return null;

    const skip = pageIndex * take;

    // Key incluye branch + filtros + paginación => cache correcto
    return [
      "/products",
      branchId,
      skip,
      take,
      search ?? "",
      categoryId ?? "",
      sortBy,
      sortOrder,
    ] as const;
  };

  const fetchPage = async (key: readonly any[]) => {
    const [, branchId, skip, take, search, categoryId, sortBy, sortOrder] = key;

    const qs = buildQuery({
      branchId,
      skip,
      take,
      search,
      categoryId,
      sortBy,
      sortOrder,
    });
    return bffGet<PageResponse>(`/api/products${qs}`);
  };

  const swr = useSWRInfinite<PageResponse>(getKey, fetchPage, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000, // 30s: evita refetch si el usuario vuelve rápido
    persistSize: true,
    keepPreviousData: true,
  });

  const pages = swr.data ?? [];
  const products = pages.flatMap((p) => p.items);
  const total = pages[0]?.total ?? 0;
  const hasMore = pages.length ? pages[pages.length - 1].hasMore : false;

  const isLoadingInitial = !swr.data && swr.isLoading;
  const isLoadingMore = swr.isLoading && !!swr.data;
  const isEmpty = !isLoadingInitial && products.length === 0;

  const loadMore = () => swr.setSize((s) => s + 1);

  return {
    ...swr,
    products,
    total,
    hasMore,
    isEmpty,
    isLoadingInitial,
    isLoadingMore,
    loadMore,
  };
}
