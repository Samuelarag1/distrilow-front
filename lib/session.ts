// Single writer of the session (docs/design/01-login-y-sesion.md §12.5 paso 3,
// invariant I8). Login, the page-load restore, every token refresh, branch
// onboarding and logout go through applySession / clearSession; nothing else
// stores the access token, the user or their branches. React reads the
// snapshot with useSyncExternalStore — the same pattern as lib/active-branch.ts,
// which keeps owning the active branch.
//
// Scope: this tab's memory. The access token is never persisted: it resets on
// every full page load by design, and the httpOnly refresh cookie (which JS
// never touches) is what restores the session. The `user`, `branches` and
// `needsOnboarding` cookies written here are only routing hints for
// middleware.ts and the optimistic first paint after a reload.

import type { AuthUser, SessionBranch, SessionInfo, UserRole } from "@/lib/api-types";
import { clearActiveBranch, reconcileActiveBranch } from "@/lib/active-branch";
import {
  clearSessionCookies,
  readClientCookie,
  setPersistentSessionCookie,
} from "@/lib/client-cookies";

export type SessionSnapshot = {
  accessToken: string | null;
  user: AuthUser | null;
  branches: SessionBranch[];
  needsOnboarding: boolean;
};

export type SessionPayload = {
  accessToken?: string | null;
  user?: unknown;
  session?: Partial<SessionInfo> | null;
};

/**
 * Who is writing. "login" is the only source allowed to replace the user of a
 * tab that already holds a session. "hint" is the optimistic restore from
 * cookies and never overrides a session already in memory.
 */
export type SessionSource = "login" | "refresh" | "hint" | "onboarding";

type Listener = () => void;

const EMPTY_SESSION: SessionSnapshot = {
  accessToken: null,
  user: null,
  branches: [],
  needsOnboarding: false,
};

const IDENTITY_CHANGED_KEY = "distrilow:identityChanged";

let snapshot: SessionSnapshot = EMPTY_SESSION;
let sessionEpoch = 0;
const listeners = new Set<Listener>();

function setSnapshot(next: SessionSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function getSession(): SessionSnapshot {
  return snapshot;
}

export function getServerSession(): SessionSnapshot {
  return EMPTY_SESSION;
}

export function getAccessToken(): string | null {
  return snapshot.accessToken;
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Increments every time the session is replaced from outside a refresh (login,
 * logout). Lets in-flight work detect that it belongs to an older session — a
 * page-load refresh failing right after the user logged in must not touch the
 * new session.
 */
export function getSessionEpoch() {
  return sessionEpoch;
}

function normalizeBranchIdValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;

  return trimmed;
}

export function normalizeSessionBranches(input: unknown): SessionBranch[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((raw, index) => {
      if (typeof raw === "string") {
        const id = normalizeBranchIdValue(raw);
        if (!id) return null;
        return { id, name: `Sucursal ${index + 1}` } satisfies SessionBranch;
      }

      if (!raw || typeof raw !== "object") return null;

      const value = raw as {
        id?: unknown;
        branchId?: unknown;
        name?: unknown;
        isDefault?: unknown;
      };
      const id =
        normalizeBranchIdValue(value.id) ??
        normalizeBranchIdValue(value.branchId) ??
        "";

      if (!id) return null;

      return {
        id,
        name:
          typeof value.name === "string" && value.name.trim()
            ? value.name
            : `Sucursal ${index + 1}`,
        isDefault: Boolean(value.isDefault),
      } satisfies SessionBranch;
    })
    .filter((branch): branch is SessionBranch => Boolean(branch));
}

function normalizeUser(input: unknown): AuthUser | null {
  if (!input || typeof input !== "object") return null;
  const value = input as { id?: unknown; email?: unknown; role?: unknown };
  if (typeof value.id !== "string" || !value.id.trim()) return null;
  if (typeof value.role !== "string" || !value.role.trim()) return null;

  return {
    id: value.id,
    email: typeof value.email === "string" ? value.email : "",
    role: value.role as UserRole,
  };
}

/**
 * The only way to write the session. Returns "identity-changed" — and applies
 * nothing — when a refresh brings a different user than the one this tab is
 * operating as: the shared refresh cookie now belongs to someone else (H7).
 */
export function applySession(
  payload: SessionPayload,
  source: SessionSource
): "applied" | "identity-changed" {
  if (source === "hint" && snapshot.accessToken) return "applied";

  const incomingUser =
    payload.user === undefined ? undefined : normalizeUser(payload.user);

  if (
    source !== "login" &&
    snapshot.accessToken &&
    snapshot.user &&
    incomingUser &&
    incomingUser.id !== snapshot.user.id
  ) {
    return "identity-changed";
  }

  const user = incomingUser === undefined ? snapshot.user : incomingUser;
  const hasBranches = payload.session?.availableBranches !== undefined;
  const branches = hasBranches
    ? normalizeSessionBranches(payload.session?.availableBranches)
    : snapshot.branches;
  const needsOnboarding =
    payload.session?.needsOnboarding ?? snapshot.needsOnboarding;
  const accessToken =
    payload.accessToken === undefined
      ? snapshot.accessToken
      : payload.accessToken?.trim() || null;

  if (source === "login") sessionEpoch += 1;

  // The branch list only re-validates the active branch; it never picks a
  // different one on its own (lib/active-branch.ts, R3).
  if (hasBranches) {
    reconcileActiveBranch({
      userId: user?.id ?? null,
      branches,
      serverDefaultBranchId: payload.session?.activeBranchId,
    });
  }

  // Hints were just read from these cookies: rewriting them would only keep
  // extending their expiry on every page load, even for a dead session.
  if (source !== "hint") {
    if (incomingUser) {
      setPersistentSessionCookie("user", JSON.stringify(incomingUser));
    }
    if (hasBranches) {
      setPersistentSessionCookie("branches", JSON.stringify(branches));
    }
    if (payload.session?.needsOnboarding !== undefined) {
      setPersistentSessionCookie("needsOnboarding", needsOnboarding);
    }
  }

  setSnapshot({ accessToken, user, branches, needsOnboarding });
  return "applied";
}

/** Logout, idle timeout, a definitive 401 or a logout from another tab. */
export function clearSession() {
  sessionEpoch += 1;
  clearActiveBranch();
  clearSessionCookies();
  setSnapshot(EMPTY_SESSION);
}

/** What the routing-hint cookies say, for the optimistic first paint. */
export function readSessionHints(): SessionPayload {
  const parse = (name: string): unknown => {
    const raw = readClientCookie(name);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  };

  const onboarding = readClientCookie("needsOnboarding");
  return {
    user: parse("user"),
    session: {
      availableBranches: normalizeSessionBranches(parse("branches")),
      ...(onboarding ? { needsOnboarding: onboarding === "true" } : {}),
    },
  };
}

// Survives the reload that follows an identity change, so the new page can
// tell the user why it reloaded.
export function markIdentityChanged() {
  try {
    window.sessionStorage.setItem(IDENTITY_CHANGED_KEY, "1");
  } catch {
    // Storage unavailable: the reload still happens, just without the notice.
  }
}

export function consumeIdentityChangedNotice(): boolean {
  try {
    const marked = window.sessionStorage.getItem(IDENTITY_CHANGED_KEY) === "1";
    window.sessionStorage.removeItem(IDENTITY_CHANGED_KEY);
    return marked;
  } catch {
    return false;
  }
}
