import useSWR from "swr";
import { Product } from "@/lib/products";
import { bffGet } from "@/lib/bff-client";

type UseProductsArgs = {
  skip?: number;
  take?: number;
  search?: string;
  categoryId?: string | null;
  branchId?: string | null;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

function buildQuery(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all")
      return;
    qs.set(key, String(value));
  });
  const serialized = qs.toString();
  return serialized ? `?${serialized}` : "";
}

export function useProducts(args: UseProductsArgs = {}) {
  const key = `/api/products${buildQuery(args)}`;
  const { data, error, isLoading, mutate } = useSWR<
    Product[] | { items: Product[] }
  >(key, bffGet);

  const products = Array.isArray(data) ? data : data?.items ?? [];

  return {
    products,
    isLoading,
    isError: error,
    mutateProducts: mutate,
  };
}
