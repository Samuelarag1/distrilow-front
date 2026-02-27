"use server";

import { serverApi } from "@/lib/server-api";

export async function getRecentAuditAction() {
  return serverApi.get("/audit/recent");
}
