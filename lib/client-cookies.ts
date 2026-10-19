// Cookies cleared on logout. The front only WRITES `user`, `branches` and
// `needsOnboarding` (routing hints for middleware.ts). The rest are legacy
// names deleted here so old browsers get cleaned up: tokens now live only as
// httpOnly cookies set by the backend, and the active branch lives per tab in
// lib/active-branch.ts, never in a cookie.
const SESSION_COOKIE_NAMES = [
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "user",
  "branches",
  "activeBranchId",
  "branchId",
  "needsOnboarding",
] as const;

export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function shouldUseSecureCookie() {
  if (typeof window !== "undefined") {
    return window.location.protocol === "https:";
  }
  return process.env.NODE_ENV === "production";
}

function buildCookieAttributes(extra: string[] = []) {
  const attrs = ["path=/", "SameSite=Lax", ...extra];
  if (shouldUseSecureCookie()) {
    attrs.push("Secure");
  }
  return attrs.join("; ");
}

export function readClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.split("=").slice(1).join("=");

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function setClientCookie(
  name: string,
  value: string | number | boolean,
  options?: { encode?: boolean; maxAgeSeconds?: number }
) {
  if (typeof document === "undefined") return;

  const encode = options?.encode ?? true;
  const serializedValue = encode
    ? encodeURIComponent(String(value))
    : String(value);
  const extra = [];

  if (typeof options?.maxAgeSeconds === "number") {
    extra.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }

  document.cookie = `${name}=${serializedValue}; ${buildCookieAttributes(extra)}`;
}

export function setPersistentSessionCookie(
  name: string,
  value: string | number | boolean,
  options?: { encode?: boolean; maxAgeSeconds?: number }
) {
  setClientCookie(name, value, {
    ...options,
    maxAgeSeconds:
      options?.maxAgeSeconds ?? SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export function deleteClientCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; ${buildCookieAttributes([
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ])}`;
}

export function clearSessionCookies() {
  SESSION_COOKIE_NAMES.forEach((cookieName) => deleteClientCookie(cookieName));
}
