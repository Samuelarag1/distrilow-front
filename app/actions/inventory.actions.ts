"use server";

import { serverApi } from "@/lib/server-api";
import { revalidatePath } from "next/cache";

export async function getProductsAction(params?: {
  skip?: number;
  take?: number;
}) {
  const query = new URLSearchParams();
  if (params?.skip) query.set("skip", String(params.skip));
  if (params?.take) query.set("take", String(params.take));

  const queryString = query.toString() ? `?${query.toString()}` : "";
  return serverApi.get(`/products${queryString}`);
}

export async function saveProductAction(id: string | null, data: any) {
  let result;
  if (id) {
    result = await serverApi.patch(`/products/${id}`, data);
  } else {
    result = await serverApi.post("/products", data);
  }
  revalidatePath("/inventory");
  return result;
}

export async function adjustStockAction(productId: string, quantity: number) {
  // Uses activeBranchId and token inside serverApi
  const result = await serverApi.post(`/stock/adjust`, {
    productId,
    quantity,
  });
  revalidatePath("/inventory");
  revalidatePath("/audit");
  return result;
}
