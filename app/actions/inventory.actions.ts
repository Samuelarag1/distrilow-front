"use server";

import { serverApi } from "@/lib/server-api";
import { revalidatePath } from "next/cache";

export async function getProductsAction(params?: {
  skip?: number;
  take?: number;
}) {
  const query = new URLSearchParams();
  if (params?.skip !== undefined) query.set("skip", String(params.skip));
  if (params?.take !== undefined) query.set("take", String(params.take));

  const queryString = query.toString() ? `?${query.toString()}` : "";
  return serverApi.get(`/products${queryString}`);
}

export async function saveProductAction(id: string | null, data: any) {
  const result = id
    ? await serverApi.patch(`/products/${id}`, data)
    : await serverApi.post("/products", data);
  revalidatePath("/inventory");
  return result;
}

export async function adjustStockAction(productId: string, quantity: number) {
  const endpoint =
    quantity >= 0
      ? "/stock-movements/adjustment-in"
      : "/stock-movements/adjustment-out";

  const result = await serverApi.post(endpoint, {
    productId,
    quantity: Math.abs(quantity),
  });

  revalidatePath("/inventory");
  revalidatePath("/reports");
  return result;
}
