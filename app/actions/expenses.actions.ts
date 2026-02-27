"use server";

import { serverApi } from "@/lib/server-api";
import { revalidatePath } from "next/cache";

export async function getExpensesAction(params?: any) {
  return serverApi.get("/expenses");
}

export async function createExpenseAction(data: any) {
  const result = await serverApi.post("/expenses", data);
  revalidatePath("/expenses");
  revalidatePath("/audit");
  return result;
}

export async function getExpenseMetricsAction(params?: any) {
  try {
    return await serverApi.get("/expenses/metrics");
  } catch (e) {
    return { error: "Metrics not available" };
  }
}
