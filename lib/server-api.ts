import { cookies } from "next/headers";
import { ApiError } from "./api-client";

function normalizeBaseUrl(base: string) {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function normalizeApiBaseCandidate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return normalizeBaseUrl(trimmed);
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return normalizeBaseUrl(`http://${trimmed}`);
  }
  return normalizeBaseUrl(`https://${trimmed}`);
}

function normalizeApiPrefix(prefix?: string) {
  const value = (prefix ?? "/api").trim();
  if (!value) return "/api";
  return value.startsWith("/") ? value : `/${value}`;
}

function resolveServerApiBaseUrl() {
  const legacyUrl =
    process.env.API_URL?.trim() ?? process.env.NEXT_PUBLIC_API_URL?.trim();

  if (legacyUrl) {
    return normalizeApiBaseCandidate(legacyUrl);
  }

  const backendUrl =
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:3000";
  const apiPrefix =
    process.env.API_PREFIX ?? process.env.NEXT_PUBLIC_API_PREFIX;

  return `${normalizeApiBaseCandidate(backendUrl)}${normalizeApiPrefix(apiPrefix)}`;
}

async function serverRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("accessToken")?.value ??
    cookieStore.get("token")?.value ??
    cookieStore.get("access_token")?.value;
  const explicitBranchId =
    cookieStore.get("activeBranchId")?.value ||
    cookieStore.get("branchId")?.value;
  let branchId = explicitBranchId;

  if (!branchId) {
    const branchesRaw = cookieStore.get("branches")?.value;
    if (branchesRaw) {
      try {
        const decoded = decodeURIComponent(branchesRaw);
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) {
          const first = parsed.find((branch) => {
            if (typeof branch === "string") return branch.trim().length > 0;
            if (!branch || typeof branch !== "object") return false;
            const obj = branch as { id?: unknown; branchId?: unknown };
            return (
              (typeof obj.id === "string" && obj.id.trim().length > 0) ||
              (typeof obj.branchId === "string" && obj.branchId.trim().length > 0)
            );
          });

          if (typeof first === "string") {
            branchId = first.trim() || undefined;
          } else if (first && typeof first === "object") {
            const obj = first as { id?: unknown; branchId?: unknown };
            if (typeof obj.id === "string" && obj.id.trim()) {
              branchId = obj.id.trim();
            } else if (typeof obj.branchId === "string" && obj.branchId.trim()) {
              branchId = obj.branchId.trim();
            }
          }
        }
      } catch {
        // Ignore invalid branches cookie payload and continue without branch header.
      }
    }
  }

  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (branchId) headers.set("x-branch-id", branchId);

  const base = resolveServerApiBaseUrl();

  const res = await fetch(`${base}${url}`, {
    ...options,
    headers,
    cache: "no-store",
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
