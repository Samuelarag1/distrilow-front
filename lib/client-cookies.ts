// accessToken/refreshToken are intentionally NOT in this list — they must
// only ever exist as httpOnly cookies set by the backend. Storing them in a
// JS-readable cookie here would hand any XSS on this page a 30-day-lived
// refresh token via a plain document.cookie read.
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
