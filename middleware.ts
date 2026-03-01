import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type SessionUser = {
  role?: string;
};

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
  const isManagement = role === "admin" || role === "manager";
  return !isManagement && branchesCount <= 1;
}

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("accessToken")?.value ??
    request.cookies.get("token")?.value ??
    request.cookies.get("access_token")?.value;
  const user = parseCookieJson<SessionUser>(request.cookies.get("user")?.value);
  const branches = parseCookieJson<Array<{ id: string }>>(
    request.cookies.get("branches")?.value
  );
  const restrictedUser = isRestrictedUser(user?.role, branches?.length ?? 0);
  const { pathname } = request.nextUrl;

  // Permitir siempre login
  if (pathname.startsWith("/login")) {
    if (token) {
      return NextResponse.redirect(new URL(restrictedUser ? "/pos" : "/", request.url));
    }
    return NextResponse.next();
  }

  // Rutas protegidas
  if (!token) {
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
