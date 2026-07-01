import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type SessionUser = {
  role?: string;
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

function isRestrictedUser(role?: string, branchesCount = 0) {
  if (!role) return false;
  if (role === "seller") return true;
  const isManagement = role === "admin" || role === "manager";
  return !isManagement && branchesCount <= 1;
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
    const restrictedUser = isRestrictedUser(user?.role, branches?.length ?? 0);
    const { pathname } = request.nextUrl;

    // Permitir siempre login
    if (pathname.startsWith("/login")) {
      // Si la sesion esta incompleta/corrupta, no forzar redirect al home:
      // dejar entrar al login para reautenticacion.
      if (hasSession && user?.role) {
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
