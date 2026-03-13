import type { AuthResponse, SessionResponse } from "@/lib/api-types";
import { clearSessionCookies, syncClientAuthCookies } from "@/lib/client-cookies";

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
  disableCache?: boolean;
};

let authToken: string | null = null;
let activeBranchId: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let lastSuccessfulRefreshAt = 0;
let lastFailedRefreshAt = 0;
let lastRefreshPayload: SessionResponse | AuthResponse | null = null;

const REFRESH_FAILURE_COOLDOWN_MS = 30_000;
const REFRESH_EXPIRY_BUFFER_MS = 2 * 60 * 1000;

const BRANCH_SCOPED_PREFIXES = [
  "/products",
  "/files/upload",
  "/stocks",
  "/stock-movements",
  "/sales",
  "/expenses",
  "/cash",
  "/analytics",
  "/reports",
] as const;

function sanitizeBranchId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;

  return trimmed;
}

function normalizeBaseUrl(base: string) {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function normalizeApiBaseCandidate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/")) return normalizeBaseUrl(trimmed);
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

function resolveApiBaseUrl() {
  const legacyUrl = process.env.NEXT_PUBLIC_API_URL;
  if (legacyUrl) return normalizeApiBaseCandidate(legacyUrl);

  const originRaw =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3000";
  const origin = normalizeApiBaseCandidate(originRaw);
  const prefix = normalizeApiPrefix(process.env.NEXT_PUBLIC_API_PREFIX);
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

function getSessionRefreshToken() {
  return getCookie("refreshToken") ?? getCookie("refresh_token");
}

function getSessionBranchId() {
  const explicitBranchId =
    sanitizeBranchId(activeBranchId) ??
    sanitizeBranchId(getCookie("activeBranchId")) ??
    sanitizeBranchId(getCookie("branchId"));
  if (explicitBranchId) return explicitBranchId;

  const branchesRaw = getCookie("branches");
  if (!branchesRaw) return null;

  try {
    const parsed = JSON.parse(branchesRaw);
    if (!Array.isArray(parsed)) return null;
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
      return sanitizeBranchId(first);
    }
    if (first && typeof first === "object") {
      const obj = first as { id?: unknown; branchId?: unknown };
      const byId = sanitizeBranchId(obj.id);
      if (byId) return byId;
      const byBranchId = sanitizeBranchId(obj.branchId);
      if (byBranchId) return byBranchId;
    }
  } catch {
    return null;
  }

  return null;
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

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(padded);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }

  return null;
}

function getTokenExpiryTime(token: string | null) {
  if (!token) return null;

  const segments = token.split(".");
  if (segments.length < 2) return null;

  try {
    const decoded = decodeBase64Url(segments[1]);
    if (!decoded) return null;
    const payload = JSON.parse(decoded) as { exp?: unknown };
    const expSeconds = Number(payload.exp);
    if (!Number.isFinite(expSeconds) || expSeconds <= 0) return null;
    return expSeconds * 1000;
  } catch {
    return null;
  }
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
    public body?: unknown,
    public retryAfterSeconds?: number | null
  ) {
    super(bodyText || `API request failed (${status})`);
  }
}

function parseRetryAfterSeconds(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (!trimmed) return null;

  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds;
  }

  const asDate = Date.parse(trimmed);
  if (Number.isNaN(asDate)) return null;

  const deltaSeconds = Math.ceil((asDate - Date.now()) / 1000);
  return deltaSeconds > 0 ? deltaSeconds : 0;
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
  if (Date.now() - lastFailedRefreshAt < REFRESH_FAILURE_COOLDOWN_MS) {
    return false;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = getSessionRefreshToken();
      const accessToken = getSessionToken();
      if (!refreshToken && !accessToken) {
        return false;
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const res = await fetch(`${resolveApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(
          refreshToken ? { refreshToken } : {}
        ),
      });

      if (!res.ok) {
        lastFailedRefreshAt = Date.now();
        return false;
      }
      const payload = (await parseResponse<SessionResponse | AuthResponse>(
        res
      )) as SessionResponse | AuthResponse | null;
      lastRefreshPayload = payload ?? null;
      const nextAccessToken = payload?.accessToken?.trim();
      if (nextAccessToken) {
        authToken = nextAccessToken;
      }
      if (payload?.session?.activeBranchId !== undefined) {
        activeBranchId = payload.session.activeBranchId ?? null;
      }
      syncClientAuthCookies({
        accessToken: nextAccessToken,
        refreshToken: payload?.refreshToken,
      });

      const hasUsableToken = Boolean(nextAccessToken || getSessionToken());
      if (!hasUsableToken) {
        lastFailedRefreshAt = Date.now();
        return false;
      }

      lastSuccessfulRefreshAt = Date.now();
      lastFailedRefreshAt = 0;

      return true;
    } catch {
      lastRefreshPayload = null;
      lastFailedRefreshAt = Date.now();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function refreshSessionIfNeeded(
  minIntervalMs = 10 * 60 * 1000,
  expiryBufferMs = REFRESH_EXPIRY_BUFFER_MS
) {
  const accessToken = getSessionToken();
  const refreshToken = getSessionRefreshToken();
  const tokenExpiryTime = getTokenExpiryTime(accessToken);

  if (!refreshToken) {
    return Boolean(accessToken);
  }

  if (
    accessToken &&
    tokenExpiryTime !== null &&
    tokenExpiryTime - Date.now() > expiryBufferMs
  ) {
    return true;
  }

  const elapsed = Date.now() - lastSuccessfulRefreshAt;
  if (
    accessToken &&
    tokenExpiryTime === null &&
    lastSuccessfulRefreshAt > 0 &&
    elapsed < minIntervalMs
  ) {
    return true;
  }
  return refreshSession();
}

export function getLastRefreshPayload() {
  return lastRefreshPayload;
}

export function setApiSession(token: ApiSessionInput, branchId?: string | null) {
  if (typeof token === "string" || token === null) {
    authToken = token;
    if (token) {
      lastSuccessfulRefreshAt = Date.now();
      lastFailedRefreshAt = 0;
    }
    activeBranchId =
      branchId === undefined ? activeBranchId : sanitizeBranchId(branchId);
    return;
  }

  authToken =
    token?.accessToken === undefined ? authToken : token?.accessToken ?? null;
  if (token?.accessToken) {
    lastSuccessfulRefreshAt = Date.now();
    lastFailedRefreshAt = 0;
  }
  activeBranchId =
    token?.branchId === undefined
      ? activeBranchId
      : sanitizeBranchId(token?.branchId);
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
  const disableCache =
    options.disableCache === undefined
      ? false
      : options.disableCache;

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

  const { _retried: _ignoredRetried, branchScoped: _ignoredBranchScoped, disableCache: _ignoredDisableCache, ...fetchOptions } =
    options;
  void _ignoredRetried;
  void _ignoredBranchScoped;
  void _ignoredDisableCache;

  const res = await fetch(`${resolveApiBaseUrl()}${path}`, {
    ...fetchOptions,
    method,
    headers,
    body: options.body,
    credentials: "include",
    cache: method === "GET" && disableCache ? "no-store" : fetchOptions.cache,
  });

  if (res.status === 401 && !options._retried && shouldTryRefresh(path, method)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      authToken = null;
      activeBranchId = null;
      clearSessionCookies();
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
    const publicMessage =
      res.status >= 500
        ? "Ocurrio un error del servidor. Intenta nuevamente en unos minutos."
        : friendlyMessage || bodyText || statusHint;
    const retryAfterSeconds = parseRetryAfterSeconds(
      res.headers.get("Retry-After")
    );

    throw new ApiError(
      res.status,
      publicMessage,
      parsedBody,
      retryAfterSeconds
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
