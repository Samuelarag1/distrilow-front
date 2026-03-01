import useSWR from "swr";
import { Product } from "@/lib/products";
import { backendApi } from "@/lib/backend-api";
import { getApiSession } from "@/lib/api-client";

type UseProductsArgs = {
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
  const key = effectiveBranchId
    ? ([
        "products",
        args.skip ?? 0,
        args.take ?? 20,
        args.search ?? "",
        args.categoryId ?? "",
        effectiveBranchId,
        args.sortBy ?? "",
        args.sortOrder ?? "asc",
      ] as const)
    : null;

  const { data, error, isLoading, mutate } = useSWR<Product[]>(
    key,
    async () => {
      const page = await backendApi.productsWithStock(
        {
          skip: args.skip,
          take: args.take,
          name: args.search ?? undefined,
          q: args.search ?? undefined,
          search: args.search ?? undefined,
          categoryId: args.categoryId ?? undefined,
          sortBy: (args.sortBy as any) ?? undefined,
          sortOrder: args.sortOrder,
        },
        effectiveBranchId
      );

      return page.items.map((item) => ({
        ...item,
        price: Number(item.retailPrice ?? item.costPrice ?? 0),
        category: item.categoryId ?? "Sin categoria",
        unit: item.measurementType,
      })) as Product[];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );

  const products = effectiveBranchId ? data ?? [] : [];

  return {
    products,
    isLoading: !!effectiveBranchId && isLoading,
    isError: error,
    mutateProducts: mutate,
  };
}
