import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@/lib/api-types";
import {
  isPathAllowedForPosCashOnly,
  isPosCashOnlyUser,
  resolvePostLoginPath,
} from "@/lib/permissions";

type SessionUser = {
  role?: UserRole;
};

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

export function middleware(request: NextRequest) {
  try {
    // The real tokens are httpOnly and may live on the API's own subdomain —
    // this middleware can't and shouldn't try to read them. `hasSession` is
    // a non-secret marker cookie the backend sets/clears alongside them
    // purely so routing decisions can be made here without touching the JWT.
    const hasSession = hasCookieValue(request.cookies.get("hasSession")?.value);
    const user = parseCookieJson<SessionUser>(request.cookies.get("user")?.value);
    const branches = parseCookieJson<Array<{ id: string }>>(
      request.cookies.get("branches")?.value
    );
    const posCashOnly = isPosCashOnlyUser(user?.role, branches?.length ?? 0);
    const { pathname, search } = request.nextUrl;

    if (pathname.startsWith("/login")) {
      // A session that looks complete goes where it belongs (or back to
      // ?next=). An incomplete or corrupt one stays, to sign in again.
      if (hasSession && user?.role) {
        const target = resolvePostLoginPath(
          request.nextUrl.searchParams.get("next"),
          { posCashOnly, needsOnboarding: false }
        );
        return NextResponse.redirect(new URL(target, request.url));
      }
      return NextResponse.next();
    }

    if (!hasSession) {
      const login = new URL("/login", request.url);
      // Back to this screen after signing in (validated by the login).
      if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }

    if (posCashOnly && !isPathAllowedForPosCashOnly(pathname)) {
      return NextResponse.redirect(new URL("/pos", request.url));
    }

    return NextResponse.next();
  } catch {
    if (request.nextUrl.pathname.startsWith("/login")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\..*).*)"],
};
