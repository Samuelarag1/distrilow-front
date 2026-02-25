import useSWRMutation from "swr/mutation";
import { apiClientFetch } from "@/lib/api-client";

async function updateProduct(
  url: string,
  { arg }: { arg: { id: string; data: any } }
) {
  return apiClientFetch.put(`/products/${arg.id}`, arg.data);
}

export function useUpdateProduct() {
  return useSWRMutation("/products", updateProduct);
}
