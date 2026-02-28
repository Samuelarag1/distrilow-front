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
    maxItems = 30,
    activeBranchId,
    search,
    categoryId,
    sortBy,
    sortOrder,
  } = args;

  const getKey = (pageIndex: number, previousPageData: PagePayload | null) => {
    if (!activeBranchId) return null;
    if (pageIndex * take >= maxItems) return null;
    if (previousPageData && getPageItems(previousPageData).length < take) {
      return null;
    }

    const skip = pageIndex * take;

    return [
      "/products",
      activeBranchId,
      skip,
      take,
      search ?? "",
      categoryId ?? "",
      sortBy,
      sortOrder,
    ] as const;
  };

  const fetchPage = async (key: readonly any[]) => {
    const [, , skip, take, search, categoryId, sortBy, sortOrder] = key;
    const remaining = Math.max(0, maxItems - Number(skip));
    const pageTake = Math.min(Number(take), remaining);

    const page = await backendApi.productsWithStock({
      skip: Number(skip),
      take: pageTake,
      search: search || undefined,
      categoryId: categoryId || undefined,
      sortBy,
      sortOrder,
    });

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
  };

  const swr = useSWRInfinite<PagePayload>(getKey, fetchPage, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    persistSize: true,
    keepPreviousData: true,
  });

  const pages = swr.data ?? [];
  const products = pages.flatMap((page) => getPageItems(page)).slice(0, maxItems);
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
    !!activeBranchId && products.length < maxItems && lastHasMore;

  const isLoadingInitial = !swr.data && swr.isLoading;
  const isLoadingMore = !!swr.data && swr.isLoading;

  const loadMore = () => swr.setSize((s) => s + 1);

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
