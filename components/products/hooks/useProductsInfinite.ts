import { useCallback } from "react";
import useSWRInfinite from "swr/infinite";
import { backendApi } from "@/lib/backend-api";
import { ApiSortBy, SortOrder } from "../types/product";
import type { Product } from "@/lib/products";

type PagePayload =
  | Product[]
  | {
      items: Product[];
      total?: number;
      hasMore?: boolean;
    };

type PageKey = readonly [
  "products",
  string,
  number,
  number,
  string,
  string,
  ApiSortBy,
  SortOrder
];

function getPageItems(page: PagePayload | null | undefined): Product[] {
  if (!page) return [];
  return Array.isArray(page) ? page : page.items ?? [];
}

export function useProductsInfinite(args: {
  take?: number;
  maxItems?: number;
  activeBranchId: string | null;
  search?: string;
  categoryId?: string | null;
  sortBy: ApiSortBy;
  sortOrder: SortOrder;
}) {
  const {
    take = 20,
    maxItems = Number.POSITIVE_INFINITY,
    activeBranchId,
    search,
    categoryId,
    sortBy,
    sortOrder,
  } = args;

  const cap = Number.isFinite(maxItems) ? Math.max(0, maxItems) : Number.POSITIVE_INFINITY;

  const getKey = useCallback((pageIndex: number, previousPageData: PagePayload | null) => {
    if (!activeBranchId) return null;

    if (Number.isFinite(cap) && pageIndex * take >= cap) {
      return null;
    }

    if (previousPageData) {
      if (!Array.isArray(previousPageData) && previousPageData.hasMore === false) {
        return null;
      }

      if (getPageItems(previousPageData).length < take) {
        return null;
      }
    }

    const skip = pageIndex * take;

    return [
      "products",
      activeBranchId,
      skip,
      take,
      search ?? "",
      categoryId ?? "",
      sortBy,
      sortOrder,
    ] as const;
  }, [activeBranchId, cap, take, search, categoryId, sortBy, sortOrder]);

  const fetchPage = useCallback(async (key: PageKey) => {
    const [, , skip, incomingTake, query, incomingCategoryId, incomingSortBy, incomingSortOrder] =
      key;

    const remaining = Number.isFinite(cap) ? Math.max(0, cap - Number(skip)) : Number(incomingTake);
    const pageTake = Number.isFinite(cap)
      ? Math.min(Number(incomingTake), remaining)
      : Number(incomingTake);

    if (pageTake <= 0) {
      return {
        items: [],
        total: 0,
        hasMore: false,
      } as PagePayload;
    }

    const page = await backendApi.productsWithStock(
      {
        skip: Number(skip),
        take: pageTake,
        name: query || undefined,
        q: query || undefined,
        search: query || undefined,
        categoryId: incomingCategoryId || undefined,
        sortBy: incomingSortBy as any,
        sortOrder: incomingSortOrder,
      },
      activeBranchId
    );

    return {
      items: page.items.map((item) => ({
        ...item,
        price: Number(item.retailPrice ?? item.costPrice ?? 0),
        category: item.categoryId ?? "Sin categoria",
        unit: item.measurementType,
      })) as Product[],
      total: page.total,
      hasMore: page.hasMore,
    } as PagePayload;
  }, [cap, activeBranchId]);

  const swr = useSWRInfinite<PagePayload>(getKey, (key) => fetchPage(key as PageKey), {
    initialSize: 1,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateFirstPage: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
    persistSize: false,
    shouldRetryOnError: false,
  });

  const pages = swr.data ?? [];
  const rawProducts = pages.flatMap((page) => getPageItems(page));
  const dedupedProducts = Array.from(
    new Map(rawProducts.map((product) => [product.id, product])).values()
  );
  const products = dedupedProducts.slice(0, cap);
  const hasDuplicatePages = dedupedProducts.length < rawProducts.length;

  const firstPage = pages[0];
  const total =
    firstPage && !Array.isArray(firstPage) && typeof firstPage.total === "number"
      ? firstPage.total
      : products.length;

  const lastPage = pages[pages.length - 1] ?? null;
  const lastItems = getPageItems(lastPage);
  const lastHasMore =
    lastPage && !Array.isArray(lastPage) && typeof lastPage.hasMore === "boolean"
      ? lastPage.hasMore
      : lastItems.length === take;

  const hasMore =
    !!activeBranchId &&
    lastHasMore &&
    !hasDuplicatePages &&
    (!Number.isFinite(cap) || products.length < cap);

  const isLoadingInitial = !swr.data && swr.isLoading;
  const isLoadingMore =
    !isLoadingInitial &&
    swr.isValidating &&
    swr.size > 0 &&
    (swr.data ? typeof swr.data[swr.size - 1] === "undefined" : true);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) {
      return Promise.resolve(swr.data);
    }
    return swr.setSize((size) => size + 1);
  }, [hasMore, isLoadingMore, swr]);

  return {
    ...swr,
    products,
    total,
    hasMore,
    isLoadingInitial,
    isLoadingMore,
    loadMore,
  };
}
