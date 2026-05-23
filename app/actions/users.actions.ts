"use server";

import { serverApi } from "@/lib/server-api";
import { revalidatePath } from "next/cache";

export async function getUsersAction() {
  return serverApi.get("/users");
}

export async function createUserAction(data: any) {
  const result = await serverApi.post("/users", data);
  revalidatePath("/users");
  revalidatePath("/audit");
  return result;
}

export async function toggleUserActiveAction(
  userId: string,
  isActive: boolean,
) {
  const result = await serverApi.patch(`/users/${userId}`, { isActive });
  revalidatePath("/users");
  return result;
}
