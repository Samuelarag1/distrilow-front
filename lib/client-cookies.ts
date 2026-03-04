const SESSION_COOKIE_NAMES = [
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "user",
  "branches",
  "activeBranchId",
  "branchId",
  "needsOnboarding",
] as const;

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

