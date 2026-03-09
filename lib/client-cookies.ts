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

const ACCESS_TOKEN_COOKIE_ALIASES = ["token", "access_token"] as const;
const REFRESH_TOKEN_COOKIE_ALIASES = ["refresh_token"] as const;
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

export function syncClientAuthCookies(payload: {
  accessToken?: string | null;
  refreshToken?: string | null;
}) {
  if (payload.accessToken !== undefined) {
    ACCESS_TOKEN_COOKIE_ALIASES.forEach((cookieName) =>
      deleteClientCookie(cookieName)
    );

    const accessToken = payload.accessToken?.trim();
    if (accessToken) {
      setPersistentSessionCookie("accessToken", accessToken);
    } else {
      deleteClientCookie("accessToken");
    }
  }

  if (payload.refreshToken !== undefined) {
    REFRESH_TOKEN_COOKIE_ALIASES.forEach((cookieName) =>
      deleteClientCookie(cookieName)
    );

    const refreshToken = payload.refreshToken?.trim();
    if (refreshToken) {
      setPersistentSessionCookie("refreshToken", refreshToken);
    } else {
      deleteClientCookie("refreshToken");
    }
  }
}
