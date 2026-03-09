import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type SessionUser = {
  role?: string;
};

function getFirstCookie(
  request: NextRequest,
  names: readonly string[]
): string | undefined {
  for (const name of names) {
    const value = request.cookies.get(name)?.value;
    if (value) return value;
  }
  return undefined;
}

function hasCookieValue(value?: string) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "undefined" && normalized !== "null";
}

function parseCookieJson<T>(value?: string): T | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as T;
  } catch {
    return null;
  }
}

function isRestrictedUser(role?: string, branchesCount = 0) {
  if (!role) return false;
  if (role === "seller") return true;
  const isManagement = role === "admin" || role === "manager";
  return !isManagement && branchesCount <= 1;
}

export function middleware(request: NextRequest) {
  const token = getFirstCookie(request, [
    "accessToken",
    "token",
    "access_token",
    "__Host-accessToken",
    "__Secure-accessToken",
    "__Host-access_token",
    "__Secure-access_token",
  ]);
  const refreshToken = getFirstCookie(request, [
    "refreshToken",
    "refresh_token",
    "__Host-refreshToken",
    "__Secure-refreshToken",
    "__Host-refresh_token",
    "__Secure-refresh_token",
  ]);
  const hasSession = hasCookieValue(token) || hasCookieValue(refreshToken);
  const user = parseCookieJson<SessionUser>(request.cookies.get("user")?.value);
  const branches = parseCookieJson<Array<{ id: string }>>(
    request.cookies.get("branches")?.value
  );
  const restrictedUser = isRestrictedUser(user?.role, branches?.length ?? 0);
  const { pathname } = request.nextUrl;

  // Permitir siempre login
  if (pathname.startsWith("/login")) {
    if (hasSession) {
      return NextResponse.redirect(new URL(restrictedUser ? "/pos" : "/", request.url));
    }
    return NextResponse.next();
  }

  // Rutas protegidas
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (restrictedUser) {
    const allowed =
      pathname === "/pos" ||
      pathname.startsWith("/pos/") ||
      pathname === "/cash" ||
      pathname.startsWith("/cash/") ||
      pathname === "/onboarding/branch" ||
      pathname.startsWith("/onboarding/branch/");

    if (pathname === "/") {
      return NextResponse.redirect(new URL("/pos", request.url));
    }

    if (!allowed) {
      return NextResponse.redirect(new URL("/pos", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\..*).*)"],
};
