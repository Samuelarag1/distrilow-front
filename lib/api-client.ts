import type { AuthResponse } from "@/lib/api-types";

type ApiSessionInput =
  | {
      accessToken?: string | null;
      branchId?: string | null;
    }
  | string
  | null;

type RequestOptions = RequestInit & {
  _retried?: boolean;
  branchScoped?: boolean;
};

let authToken: string | null = null;
let activeBranchId: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

const BRANCH_SCOPED_PREFIXES = [
  "/products",
  "/files/upload",
  "/stocks",
  "/stock-movements",
  "/sales",
  "/expenses",
  "/cash",
  "/analytics",
] as const;

function normalizeBaseUrl(base: string) {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function resolveApiBaseUrl() {
  const legacyUrl = process.env.NEXT_PUBLIC_API_URL;
  if (legacyUrl) return normalizeBaseUrl(legacyUrl);

  const origin =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3000";
  const prefix = process.env.NEXT_PUBLIC_API_PREFIX ?? "/api";
  return `${normalizeBaseUrl(origin)}${prefix.startsWith("/") ? "" : "/"}${prefix}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function getSessionToken() {
  return (
    authToken ??
    getCookie("accessToken") ??
    getCookie("token") ??
    getCookie("access_token")
  );
}

function getSessionBranchId() {
  return activeBranchId ?? getCookie("activeBranchId") ?? getCookie("branchId");
}

function isBranchScopedPath(path: string) {
  return BRANCH_SCOPED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function isJsonBody(body: BodyInit | null | undefined) {
  if (!body) return false;
  return !(
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  );
}

function shouldTryRefresh(path: string, method: string) {
  if (path === "/auth/login") return false;
  if (path === "/auth/refresh") return false;
  if (path === "/auth/logout") return false;
  if (method.toUpperCase() === "OPTIONS") return false;
  return true;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return null as T;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  const text = await res.text();
  return (text as unknown) as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public bodyText: string,
    public body?: unknown
  ) {
    super(bodyText || `API request failed (${status})`);
  }
}

function extractApiMessage(body: unknown, fallback: string) {
  if (!body) return fallback;
  if (typeof body === "string") return body || fallback;
  if (typeof body === "object" && body !== null) {
    const msg =
      (body as any).message ??
      (body as any).error ??
      (body as any).details?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${resolveApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) return false;
      const payload = (await parseResponse<AuthResponse>(
        res
      )) as AuthResponse | null;
      if (payload?.accessToken) {
        authToken = payload.accessToken;
      }
      if (payload?.session?.activeBranchId !== undefined) {
        activeBranchId = payload.session.activeBranchId ?? null;
      }

      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function setApiSession(token: ApiSessionInput, branchId?: string | null) {
  if (typeof token === "string" || token === null) {
    authToken = token;
    activeBranchId = branchId === undefined ? activeBranchId : branchId;
    return;
  }

  authToken =
    token?.accessToken === undefined ? authToken : token?.accessToken ?? null;
  activeBranchId =
    token?.branchId === undefined ? activeBranchId : token?.branchId ?? null;
}

export function getApiSession() {
  return {
    accessToken: getSessionToken(),
    branchId: getSessionBranchId(),
  };
}

async function request<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const branchScoped =
    options.branchScoped === undefined
      ? isBranchScopedPath(path)
      : options.branchScoped;

  const headers = new Headers(options.headers);
  if (isJsonBody(options.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const tokenToUse = getSessionToken();
  const branchToUse = branchScoped ? getSessionBranchId() : null;

  if (tokenToUse && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${tokenToUse}`);
  }
  if (branchScoped && branchToUse && !headers.has("x-branch-id")) {
    headers.set("x-branch-id", branchToUse);
  }

  const res = await fetch(`${resolveApiBaseUrl()}${path}`, {
    ...options,
    method,
    headers,
    body: options.body,
    credentials: "include",
  });

  if (res.status === 401 && !options._retried && shouldTryRefresh(path, method)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      const expire = "expires=Thu, 01 Jan 1970 00:00:00 UTC";
      document.cookie = `token=; path=/; ${expire}`;
      document.cookie = `accessToken=; path=/; ${expire}`;
      document.cookie = `refreshToken=; path=/; ${expire}`;
      document.cookie = `user=; path=/; ${expire}`;
      document.cookie = `branches=; path=/; ${expire}`;
      document.cookie = `activeBranchId=; path=/; ${expire}`;
      document.cookie = `needsOnboarding=; path=/; ${expire}`;
      window.location.href = "/login";
    }

    const contentType = res.headers.get("content-type") ?? "";
    let bodyText = "";
    let parsedBody: unknown;
    let friendlyMessage = "";

    try {
      if (contentType.includes("application/json")) {
        parsedBody = await res.json();
        bodyText =
          typeof parsedBody === "object" && parsedBody !== null
            ? JSON.stringify(parsedBody)
            : String(parsedBody ?? "");
        friendlyMessage = extractApiMessage(parsedBody, bodyText);
      } else {
        bodyText = await res.text();
        friendlyMessage = bodyText;
      }
    } catch {
      bodyText = "";
      friendlyMessage = "";
    }

    const statusHint =
      res.status === 403
        ? "No tienes acceso a esta sucursal o no hay sucursal activa en la sesion."
        : `API request failed (${res.status})`;

    throw new ApiError(
      res.status,
      friendlyMessage || bodyText || statusHint,
      parsedBody
    );
  }

  return parseResponse<T>(res);
}

export const apiClientFetch = {
  get: <T = unknown>(url: string, options?: Omit<RequestOptions, "method">) =>
    request<T>(url, options),
  post: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  put: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  patch: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  delete: <T = unknown>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: "DELETE" }),
};

export const api = apiClientFetch;

export async function apiGet<T>(url: string): Promise<T> {
  return apiClientFetch.get<T>(url);
}
