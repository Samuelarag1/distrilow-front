"use server";

import { serverApi } from "@/lib/server-api";
import { revalidatePath } from "next/cache";

export async function getSalesAction() {
  return serverApi.get("/sales");
}

export async function createSaleAction(data: any) {
  const result = await serverApi.post("/sales", data);
  revalidatePath("/sales");
  revalidatePath("/reports");
  return result;
}

export async function getSalesMetricsAction() {
  try {
    return await serverApi.get(
      "/reporting/dashboard/summary?period=monthly&scope=active"
    );
  } catch {
    return { error: "Metrics not available" };
  }
}
