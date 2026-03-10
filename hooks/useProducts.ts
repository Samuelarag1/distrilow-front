import { useEffect, useRef } from "react";
import useSWR from "swr";
import { Product } from "@/lib/products";
import { backendApi } from "@/lib/backend-api";
import { getApiSession } from "@/lib/api-client";
import { subscribeProductsSync } from "@/lib/products-live-sync";
import type { NormalizedProductsPage } from "@/lib/backend-api";

export type UseProductsArgs = {
  skip?: number;
  take?: number;
  search?: string;
  categoryId?: string | null;
  branchId?: string | null;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  resolveStockFromStocksEndpoint?: boolean;
};

export function useProducts(args: UseProductsArgs = {}) {
  const lastSyncAtRef = useRef(0);
  const effectiveBranchId = args.branchId ?? getApiSession().branchId ?? null;
  const requestedSkip = args.skip ?? 0;
  const requestedTake = args.take ?? 20;
  const resolveStockFromStocksEndpoint =
    args.resolveStockFromStocksEndpoint ?? true;
  const key = effectiveBranchId
    ? ([
        "products",
        requestedSkip,
        requestedTake,
        args.search ?? "",
        args.categoryId ?? "",
        effectiveBranchId,
        args.sortBy ?? "",
        args.sortOrder ?? "asc",
        resolveStockFromStocksEndpoint ? "with-stock-fallback" : "products-only",
      ] as const)
    : null;

  const normalizedSortBy =
    args.sortBy === "createdAt" ||
    args.sortBy === "name" ||
    args.sortBy === "sku" ||
    args.sortBy === "price"
      ? args.sortBy
      : undefined;

  const { data, error, isLoading, mutate } = useSWR<NormalizedProductsPage>(
    key,
    async () => {
      const normalizedQuery = {
        skip: requestedSkip,
        take: requestedTake,
        name: args.search ?? undefined,
        q: args.search ?? undefined,
        search: args.search ?? undefined,
        categoryId: args.categoryId ?? undefined,
        sortBy: normalizedSortBy,
        sortOrder: args.sortOrder,
      };

      const page = resolveStockFromStocksEndpoint
        ? await backendApi.productsWithStock(normalizedQuery, effectiveBranchId)
        : await (async () => {
            const payload = await backendApi.products.list(
              normalizedQuery,
              effectiveBranchId
            );
            const offset = payload.meta.offset ?? requestedSkip;
            const limit = payload.meta.limit ?? requestedTake;
            return {
              items: payload.items,
              total: payload.meta.total,
              skip: offset,
              take: limit,
              nextSkip: payload.meta.hasMore ? offset + limit : null,
              hasMore: payload.meta.hasMore,
            } satisfies NormalizedProductsPage;
          })();

      return {
        ...page,
        items: page.items.map((item) => ({
          ...item,
          price: Number(item.retailPrice ?? item.costPrice ?? 0),
          category: item.categoryId ?? "Sin categoria",
          unit: item.measurementType,
        })) as Product[],
      };
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 2_500,
      refreshInterval: 0,
      refreshWhenHidden: false,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );

  useEffect(() => {
    if (!effectiveBranchId) return;

    return subscribeProductsSync((payload) => {
      if (payload.branchId && payload.branchId !== effectiveBranchId) return;
      const now = Date.now();
      if (now - lastSyncAtRef.current < 700) return;
      lastSyncAtRef.current = now;
      // Revalidate on any products sync event to avoid stale pricing snapshots.
      // Branch-scoped filtering is handled by the query itself (x-branch-id).
      void mutate();
    });
  }, [effectiveBranchId, mutate]);

  const fallbackPage: NormalizedProductsPage = {
    items: [],
    total: 0,
    skip: requestedSkip,
    take: requestedTake,
    nextSkip: null,
    hasMore: false,
  };

  const pageData = effectiveBranchId ? data ?? fallbackPage : fallbackPage;
  const products = pageData.items as Product[];

  return {
    products,
    total: pageData.total,
    skip: pageData.skip,
    take: pageData.take,
    nextSkip: pageData.nextSkip,
    hasMore: pageData.hasMore,
    isLoading: !!effectiveBranchId && isLoading,
    isError: error,
    mutateProducts: mutate,
  };
}
