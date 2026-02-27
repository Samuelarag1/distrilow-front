// src/lib/api-client.ts
let authToken: string | null = null;
let activeBranchId: string | null = null;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function setApiSession(token: string | null, branchId?: string | null) {
  authToken = token || null;

  if (branchId === undefined || branchId === null || branchId === "") {
    activeBranchId = null;
  } else {
    activeBranchId = branchId;
  }
}

export class ApiError extends Error {
  constructor(public status: number, public bodyText: string) {
    super(bodyText || `API request failed (${status})`);
  }
}

async function request<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  // Solo setear JSON si corresponde
  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
  }

  // Fallback: si no está en memoria, lo leo de cookies (las que vos seteás en login)
  const tokenToUse = authToken ?? getCookie("token");
  const branchToUse =
    activeBranchId ?? getCookie("activeBranchId") ?? getCookie("branchId");

  if (tokenToUse) headers.set("Authorization", `Bearer ${tokenToUse}`);
  if (branchToUse) headers.set("X-Branch-Id", branchToUse);

  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined");

  const res = await fetch(`${base}${url}`, {
    ...options,
    headers,
    // Si después migrás a cookies HttpOnly reales, esto ayuda.
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text);
  }

  // Soportar 204 No Content
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const apiClientFetch = {
  get: <T = any>(url: string) => request<T>(url),
  post: <T = any>(url: string, body: any) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T = any>(url: string, body: any) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T = any>(url: string, body: any) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T = any>(url: string) => request<T>(url, { method: "DELETE" }),
};

// Backward-compatible alias for modules that still import `api`.
export const api = apiClientFetch;

export async function apiGet<T>(url: string): Promise<T> {
  return apiClientFetch.get<T>(url);
}
