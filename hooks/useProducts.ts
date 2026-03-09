import { useEffect } from "react";
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
};

export function useProducts(args: UseProductsArgs = {}) {
  const effectiveBranchId = args.branchId ?? getApiSession().branchId ?? null;
  const requestedSkip = args.skip ?? 0;
  const requestedTake = args.take ?? 20;
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
      const page = await backendApi.productsWithStock(
        {
          skip: requestedSkip,
          take: requestedTake,
          name: args.search ?? undefined,
          q: args.search ?? undefined,
          search: args.search ?? undefined,
          categoryId: args.categoryId ?? undefined,
          sortBy: normalizedSortBy,
          sortOrder: args.sortOrder,
        },
        effectiveBranchId
      );

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
      dedupingInterval: 2000,
      refreshInterval: effectiveBranchId ? 4000 : 0,
      refreshWhenHidden: true,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );

  useEffect(() => {
    if (!effectiveBranchId) return;

    return subscribeProductsSync(() => {
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
