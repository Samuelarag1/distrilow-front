import { cookies } from "next/headers";
import { ApiError } from "./api-client";

async function serverRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const branchId = cookieStore.get("activeBranchId")?.value || cookieStore.get("branchId")?.value;

  const headers = new Headers(options.headers);
  
  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (branchId) headers.set("X-Branch-Id", branchId);

  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

  const res = await fetch(`${base}${url}`, {
    ...options,
    headers,
    cache: 'no-store'
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const serverApi = {
  get: <T = any>(url: string) => serverRequest<T>(url),
  post: <T = any>(url: string, body: any) =>
    serverRequest<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T = any>(url: string, body: any) =>
    serverRequest<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T = any>(url: string, body: any) =>
    serverRequest<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T = any>(url: string) => serverRequest<T>(url, { method: "DELETE" }),
};
