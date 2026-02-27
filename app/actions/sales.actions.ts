"use server";

import { serverApi } from "@/lib/server-api";
import { revalidatePath } from "next/cache";

export async function getSalesAction(params?: any) {
  return serverApi.get("/sales");
}

export async function createSaleAction(data: any) {
  const result = await serverApi.post("/sales", data);
  revalidatePath("/sales");
  revalidatePath("/audit");
  return result;
}

export async function getSalesMetricsAction(params?: any) {
  // If endpoint doesn't exist natively, we might simulate from sales,
  // but let's assume /metrics/sales or /sales/metrics
  try {
    return await serverApi.get("/sales/metrics");
  } catch (e) {
    return { error: "Metrics not available" };
  }
}
