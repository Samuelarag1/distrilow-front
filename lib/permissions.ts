import type { UserRole } from "@/lib/api-types";

// Every role rule of the front lives here. Routes (middleware.ts), the menu
// (AppSidebar) and actions (cash, POS) ask these functions instead of
// comparing roles themselves, so a rule changes in one place.
// Only admin manages.
const MANAGEMENT_ROLES: UserRole[] = ["admin"];
// Everyone who works a register. "staff" exists in the database but has no
// permission on any route (doc 03, D19).
const CASH_ROLES: UserRole[] = ["admin", "cashier", "seller"];

export function isManagementRole(role?: UserRole | null) {
  return !!role && MANAGEMENT_ROLES.includes(role);
}

export function canManageCash(role?: UserRole | null) {
  return !!role && CASH_ROLES.includes(role);
}

export function isBranchLockedUser(role?: UserRole | null, branchesCount = 0) {
  if (!role) return false;
  return !isManagementRole(role) && branchesCount <= 1;
}

export function canSwitchBranches(role?: UserRole | null, branchesCount = 0) {
  return branchesCount > 1;
}

export function isPosCashOnlyUser(role?: UserRole | null, branchesCount = 0) {
  if (role === "seller") return true;
  return isBranchLockedUser(role, branchesCount);
}

export function canAccessExpenses(role?: UserRole | null, branchesCount = 0) {
  return !isPosCashOnlyUser(role, branchesCount);
}

// The only screens a POS/cash-only user can open (enforced by middleware.ts).
const POS_CASH_ONLY_PATHS = ["/pos", "/cash", "/onboarding/branch"];

export function isPathAllowedForPosCashOnly(pathname: string) {
  return POS_CASH_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * Where to go after signing in. `next` is the screen the user was on when
 * the session ended (?next=, set by middleware.ts and forceLogout): only an
 * internal path, never /login itself, and only one this user may open.
 */
export function resolvePostLoginPath(
  next: string | null | undefined,
  user: { posCashOnly: boolean; needsOnboarding: boolean }
) {
  if (user.needsOnboarding) return "/onboarding/branch";
  const home = user.posCashOnly ? "/pos" : "/";
  const path = toInternalPath(next);
  if (!path) return home;
  if (user.posCashOnly && !isPathAllowedForPosCashOnly(pathOnly(path))) {
    return home;
  }
  return path;
}

/** `/sales?from=1` as typed, or null for anything that could leave the site. */
function toInternalPath(raw: string | null | undefined) {
  if (!raw || raw.length > 512) return null;
  // "//evil.com" and "/\evil.com" are protocol-relative URLs to the browser.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return null;
  }
  if ([...raw].some((char) => char.charCodeAt(0) < 0x20)) return null;
  const path = pathOnly(raw);
  if (path === "/login" || path.startsWith("/login/")) return null;
  return raw;
}

function pathOnly(path: string) {
  return path.split(/[?#]/, 1)[0];
}
