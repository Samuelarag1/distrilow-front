import useSWRInfinite from "swr/infinite";
import { apiGet } from "@/lib/api-client";
import { buildQuery } from "../utils/query";
import { ApiSortBy, SortOrder } from "../types/product";
import type { Product } from "@/lib/products";

export function useProductsInfinite(args: {
  take?: number;
  activeBranchId: string | null;
  search?: string;
  categoryId?: string | null;
  sortBy: ApiSortBy;
  sortOrder: SortOrder;
}) {
  const {
    take = 20,
    activeBranchId,
    search,
    categoryId,
    sortBy,
    sortOrder,
  } = args;

  const getKey = (pageIndex: number, previousPageData: Product[] | null) => {
    if (!activeBranchId) return null;
    // si la página anterior trajo menos que "take", asumimos que no hay más
    if (previousPageData && previousPageData.length < take) return null;

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
    const [, branchId, skip, take, search, categoryId, sortBy, sortOrder] = key;

    const qs = buildQuery({
      // si tu backend necesita branchId, mandalo en query
      branchId,
      skip,
      take,
      search,
      categoryId,
      sortBy,
      sortOrder,
    });

    // OJO: ahora esperamos Product[]
    return apiGet<Product[]>(`/api/products${qs}`);
  };

  const swr = useSWRInfinite<Product[]>(getKey, fetchPage, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    persistSize: true,
    keepPreviousData: true,
  });

  const pages = swr.data ?? [];
  const products = pages.flatMap((arr) => arr);

  // total real no viene: usamos lo cargado (o mostrás "—")
  const total = products.length;

  // hasMore: si la última página vino llena (take), probablemente hay más
  const lastPage = pages[pages.length - 1] ?? [];
  const hasMore = !!activeBranchId && lastPage.length === take;

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
