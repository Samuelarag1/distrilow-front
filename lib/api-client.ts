import type { SessionResponse } from "@/lib/api-types";
import { getActiveBranchId } from "@/lib/active-branch";
import {
  applySession,
  clearSession,
  getAccessToken,
  getSessionEpoch,
  markIdentityChanged,
} from "@/lib/session";

type RequestOptions = RequestInit & {
  _retried?: boolean;
  disableCache?: boolean;
};

/**
 * Outcome of renewing the access token (docs/design/01-login-y-sesion.md §6.4).
 * - ok: there is a fresh access token.
 * - invalid: the server said no (401/403): the session is over.
 * - unavailable: no answer (network error, 5xx, 429). The session may be
 *   perfectly valid, so it is kept — a failure to ask is not a "no" (H2, I3).
 */
export type RefreshResult = "ok" | "invalid" | "unavailable";

let refreshPromise: Promise<RefreshResult> | null = null;
let lastSuccessfulRefreshAt = 0;
// Set only when the server explicitly asks to wait (Retry-After on 429/503).
let refreshBlockedUntil = 0;

const REFRESH_EXPIRY_BUFFER_MS = 2 * 60 * 1000;
const SESSION_UNAVAILABLE_MESSAGE =
  "No pudimos confirmar tu sesión con el servidor. Revisá la conexión y volvé a intentar.";

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

function shouldAttachAuthorizationHeader(path: string) {
  return !(
    path === "/auth/login" ||
    path === "/auth/refresh" ||
    path === "/auth/logout"
  );
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
    const record = body as Record<string, unknown>;
    const details = record.details;
    const msg =
      record.message ??
      record.error ??
      (typeof details === "object" && details !== null
        ? (details as Record<string, unknown>).message
        : undefined);
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

async function refreshSession(): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise;
  if (Date.now() < refreshBlockedUntil) return "unavailable";

  refreshPromise = (async (): Promise<RefreshResult> => {
    // If a login/logout replaces the session while this refresh is in flight,
    // its answer is about the OLD session and must not touch the new one —
    // e.g. the page-load refresh failing right after the user logged in.
    // "ok" lets a waiting request retry with the new token.
    const epoch = getSessionEpoch();
    const superseded = () => epoch !== getSessionEpoch();

    try {
      // Neither the refresh token nor an Authorization header: the httpOnly
      // refreshToken cookie travels on its own via credentials:"include".
      const res = await fetch(`${resolveApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (superseded()) return "ok";
      if (res.status === 401 || res.status === 403) return "invalid";
      if (!res.ok) {
        const retryAfterSeconds = parseRetryAfterSeconds(
          res.headers.get("Retry-After")
        );
        if (retryAfterSeconds) {
          refreshBlockedUntil = Date.now() + retryAfterSeconds * 1000;
        }
        return "unavailable";
      }

      const payload = await parseResponse<SessionResponse | null>(res);
      if (superseded()) return "ok";
      if (!payload?.accessToken?.trim()) return "unavailable";

      if (applySession(payload, "refresh") === "identity-changed") {
        reloadAfterIdentityChange();
        return "invalid";
      }

      lastSuccessfulRefreshAt = Date.now();
      return "ok";
    } catch {
      return superseded() ? "ok" : "unavailable";
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function refreshSessionIfNeeded(
  minIntervalMs = 10 * 60 * 1000,
  expiryBufferMs = REFRESH_EXPIRY_BUFFER_MS
): Promise<RefreshResult> {
  const accessToken = getAccessToken();
  const tokenExpiryTime = getTokenExpiryTime(accessToken);

  if (
    accessToken &&
    tokenExpiryTime !== null &&
    tokenExpiryTime - Date.now() > expiryBufferMs
  ) {
    return "ok";
  }

  const elapsed = Date.now() - lastSuccessfulRefreshAt;
  if (
    accessToken &&
    tokenExpiryTime === null &&
    lastSuccessfulRefreshAt > 0 &&
    elapsed < minIntervalMs
  ) {
    return "ok";
  }

  // No usable access token in memory (fresh tab, reload, or it expired) —
  // ask the backend directly. It succeeds if the httpOnly refresh cookie is
  // still valid.
  return refreshSession();
}

export function getApiSession() {
  return {
    accessToken: getAccessToken(),
    branchId: getActiveBranchId(),
  };
}

async function request<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const res = await executeRequest(path, options);
  await ensureResponseOkOrThrow(res);
  return parseResponse<T>(res);
}

export interface ApiClientResponse<T> {
  status: number;
  headers: Headers;
  data: T | null;
}

async function requestWithMetadata<T = unknown>(
  path: string,
  options: RequestOptions = {},
  acceptedStatuses: number[] = []
): Promise<ApiClientResponse<T>> {
  const res = await executeRequest(path, options);
  const acceptedStatusSet = new Set(acceptedStatuses);

  if (!res.ok && !acceptedStatusSet.has(res.status)) {
    await ensureResponseOkOrThrow(res);
  }

  if (res.status === 204 || res.status === 304) {
    return {
      status: res.status,
      headers: res.headers,
      data: null,
    };
  }

  return {
    status: res.status,
    headers: res.headers,
    data: await parseResponse<T>(res),
  };
}

async function executeRequest(
  path: string,
  options: RequestOptions = {}
): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const disableCache =
    options.disableCache === undefined
      ? false
      : options.disableCache;

  const headers = new Headers(options.headers);
  if (isJsonBody(options.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const tokenToUse = getAccessToken();
  const branchToUse = getActiveBranchId();

  if (
    tokenToUse &&
    shouldAttachAuthorizationHeader(path) &&
    !headers.has("Authorization")
  ) {
    headers.set("Authorization", `Bearer ${tokenToUse}`);
  }
  // Every request carries the active branch; routes without branch scope
  // ignore it. With no active branch the header is omitted and branch-scoped
  // routes answer 400 — failing loudly instead of guessing a branch.
  if (branchToUse && !headers.has("x-branch-id")) {
    headers.set("x-branch-id", branchToUse);
  }

  const { _retried: _ignoredRetried, disableCache: _ignoredDisableCache, ...fetchOptions } =
    options;
  void _ignoredRetried;
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
    if (refreshed === "unavailable") {
      // The server couldn't confirm the session, which doesn't mean it's
      // over: fail this request without logging the user out (H2, I3).
      throw new ApiError(503, SESSION_UNAVAILABLE_MESSAGE);
    }
    if (refreshed === "ok") {
      // Retry against the same branch as the first attempt, even if the user
      // switched meanwhile — otherwise data from the new branch would land
      // under the caller's (old-branch) cache key. Authorization is dropped
      // so the retry picks up the refreshed token.
      const retryHeaders = new Headers(headers);
      retryHeaders.delete("Authorization");
      return executeRequest(path, {
        ...options,
        headers: retryHeaders,
        _retried: true,
      });
    }
  }

  return res;
}

let isLeavingPage = false;

/**
 * Single place that tears a dead/killed session down and sends the user to
 * /login. Guarded so that a fan-out of concurrent failures (every widget on
 * a page 401ing at once, or a background idle-timeout firing alongside a
 * failed request) only navigates once instead of racing several redirects.
 *
 * `returnHere`: the session expired on its own, so after signing in again
 * the user comes back to this screen (?next=, validated by the login). An
 * explicit or idle logout doesn't.
 */
export function forceLogout({ returnHere = false }: { returnHere?: boolean } = {}) {
  if (typeof window === "undefined" || isLeavingPage) return;
  const { pathname, search } = window.location;
  if (pathname.startsWith("/login")) return;

  isLeavingPage = true;
  clearSession();
  window.location.href =
    returnHere && pathname !== "/"
      ? `/login?next=${encodeURIComponent(`${pathname}${search}`)}`
      : "/login";
}

/**
 * Another user signed in on this browser (the refresh cookie is shared by
 * every tab), so this tab must never act as them (H7, invariant I1). Nothing
 * of the new session is applied: the tab reloads and starts over as whoever
 * is signed in now. The cookies are left alone — they belong to the new user.
 */
function reloadAfterIdentityChange() {
  if (typeof window === "undefined" || isLeavingPage) return;

  isLeavingPage = true;
  markIdentityChanged();
  window.location.reload();
}

async function ensureResponseOkOrThrow(res: Response): Promise<void> {
  if (res.ok) return;

  if (res.status === 401) {
    forceLogout({ returnHere: true });
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
      ? "No tenés acceso a esta sucursal o no hay una sucursal activa en la sesión."
      : `API request failed (${res.status})`;
  const publicMessage =
    res.status >= 500
      ? "Ocurrió un error del servidor. Volvé a intentar en unos minutos."
      : friendlyMessage || bodyText || statusHint;
  const retryAfterSeconds = parseRetryAfterSeconds(res.headers.get("Retry-After"));

  throw new ApiError(res.status, publicMessage, parsedBody, retryAfterSeconds);
}

export const apiClientFetch = {
  get: <T = unknown>(url: string, options?: Omit<RequestOptions, "method">) =>
    request<T>(url, options),
  getWithMetadata: <T = unknown>(
    url: string,
    options?: Omit<RequestOptions, "method">,
    acceptedStatuses?: number[]
  ) => requestWithMetadata<T>(url, options, acceptedStatuses),
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
