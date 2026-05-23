"use server";

import { serverApi } from "@/lib/server-api";
import { revalidatePath } from "next/cache";

export async function getExpensesAction() {
  return serverApi.get("/expenses");
}

export async function createExpenseAction(data: any) {
  const result = await serverApi.post("/expenses", data);
  revalidatePath("/expenses");
  revalidatePath("/reports");
  return result;
}

export async function getExpenseMetricsAction() {
  try {
    return await serverApi.get(
      "/reporting/dashboard/summary?period=monthly&scope=active"
    );
  } catch {
    return { error: "Metrics not available" };
  }
}
