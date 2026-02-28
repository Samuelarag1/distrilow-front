import useSWR from "swr";
import { Product } from "@/lib/products";
import { backendApi } from "@/lib/backend-api";

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
  const key = [
    "products",
    args.skip ?? 0,
    args.take ?? 20,
    args.search ?? "",
    args.categoryId ?? "",
    args.branchId ?? "",
    args.sortBy ?? "",
    args.sortOrder ?? "asc",
  ] as const;
  const { data, error, isLoading, mutate } = useSWR<Product[]>(
    key,
    async () => {
      const page = await backendApi.productsWithStock({
        skip: args.skip,
        take: args.take,
        search: args.search ?? undefined,
        categoryId: args.categoryId ?? undefined,
        sortBy: (args.sortBy as any) ?? undefined,
        sortOrder: args.sortOrder,
      });

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
    }
  );

  const products = data ?? [];

  return {
    products,
    isLoading,
    isError: error,
    mutateProducts: mutate,
  };
}
