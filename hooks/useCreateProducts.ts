import useSWRMutation from "swr/mutation";
import { apiClientFetch } from "@/lib/api-client";

async function createProduct(url: string, { arg }: { arg: any }) {
  return apiClientFetch.post(url, arg);
}

export function useCreateProduct() {
  return useSWRMutation("/products", createProduct);
}
