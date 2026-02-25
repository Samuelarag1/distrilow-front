import useSWR from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";
import { Product } from "@/lib/products";

export function useProducts() {
  const { data, error, isLoading, mutate } = useSWR<Product[]>(
    "/products",
    swrFetcher
  );

  return {
    products: data || [],
    isLoading,
    isError: error,
    mutateProducts: mutate,
  };
}
