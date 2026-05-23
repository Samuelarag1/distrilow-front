import useSWRMutation from "swr/mutation";
import { apiClientFetch } from "@/lib/api-client";

async function deleteProduct(url: string, { arg }: { arg: string }) {
  return apiClientFetch.delete(`/products/${arg}`);
}

export function useDeleteProduct() {
  return useSWRMutation("/products", deleteProduct);
}
