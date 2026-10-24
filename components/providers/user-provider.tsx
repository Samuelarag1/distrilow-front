"use client";

import { usePathname } from "next/navigation";
import { forceLogout, refreshSessionIfNeeded } from "@/lib/api-client";
import {
  getActiveBranchId,
  reloadOnBranchSwitch,
  selectBranch,
  subscribeActiveBranch,
} from "@/lib/active-branch";
import { emitAuthSync, subscribeAuthSync } from "@/lib/auth-live-sync";
import { backendApi } from "@/lib/backend-api";
import { readClientCookie } from "@/lib/client-cookies";
import { readAvatars, saveAvatar } from "@/lib/user-avatar";
import {
  applySession,
  clearSession,
  consumeIdentityChangedNotice,
  getServerSession,
  getSession,
  getSessionEpoch,
  readSessionHints,
  subscribeSession,
} from "@/lib/session";
import { resolveIdleLogoutTimeoutMs, useIdleLogout } from "@/hooks/use-idle-logout";
import { useToast } from "@/hooks/use-toast";
import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { SessionBranch, UserRole } from "@/lib/api-types";
import { SessionGate, type SessionGateStatus } from "@/components/providers/session-gate";

// Routes that render without a confirmed session.
function isPublicRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/offline"
  );
}

// 20 min with no mouse/keyboard/touch/scroll activity in any tab logs the
// session out automatically — except while a /pos tab is open, where a
// cashier with an open till is physically present (decision D6,
// docs/design/01-login-y-sesion.md). NEXT_PUBLIC_IDLE_TIMEOUT_MS can change
// it, but never below 10 min (resolveIdleLogoutTimeoutMs).
const IDLE_LOGOUT_TIMEOUT_MS = resolveIdleLogoutTimeoutMs(
  process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS
);

// When the server can't be reached on page load, the session is kept and the
// restore is retried on this schedule (the last value repeats).
const RESTORE_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000];

export interface User {
  id: string;
  email?: string;
  name?: string;
  role: UserRole;
  avatar?: string;
}

export type Branch = SessionBranch;

interface UserContextType {
  token: string | null;
  currentUser: User | null;

  branchId: string | null;
  branches: Branch[];
  needsOnboarding: boolean;

  setAvatar: (avatar: string | null) => void;
  switchBranch: (id: string) => Promise<void>;

  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function restoreRetryDelay(attempt: number) {
  const base =
    RESTORE_RETRY_DELAYS_MS[Math.min(attempt, RESTORE_RETRY_DELAYS_MS.length - 1)];
  // ±20% jitter, so terminals that lost the server together don't retry in lockstep.
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toast } = useToast();
  // The session has a single writer, lib/session.ts; this provider only reads it.
  const session = useSyncExternalStore(
    subscribeSession,
    getSession,
    getServerSession
  );
  const branchId = useSyncExternalStore(
    subscribeActiveBranch,
    getActiveBranchId,
    () => null
  );
  // Reading the avatars during hydration is safe: there is no user to render
  // until the session store fills in after mount.
  const [avatars, setAvatars] = useState(readAvatars);
  // Outcome of the page-load restore, for the screen shown while there is no
  // confirmed session (see SessionGate below).
  const [restoreStatus, setRestoreStatus] = useState<SessionGateStatus>("checking");
  const retryRestoreNow = useRef<() => void>(() => {});
  const isPosRoute = pathname === "/pos" || pathname.startsWith("/pos/");
  // A session is confirmed only once there is an access token in memory. The
  // `user` cookie is just a routing hint: it can outlive a dead session.
  const hasToken = Boolean(session.accessToken);

  const currentUser = useMemo<User | null>(() => {
    if (!session.user) return null;
    const avatar = avatars[session.user.id];
    return {
      ...session.user,
      name: session.user.email,
      ...(avatar ? { avatar } : {}),
    };
  }, [session.user, avatars]);

  const userId = session.user?.id;
  const setAvatar = useCallback(
    (avatar: string | null) => {
      if (userId) setAvatars(saveAvatar(userId, avatar));
    },
    [userId]
  );

  // Page load: optimistic first paint from the routing-hint cookies, then the
  // httpOnly refresh cookie confirms (or ends) the session. Only a "no" from
  // the server ends it; if the server can't be reached, the session is kept
  // and the restore is retried (H2, invariant I3).
  useEffect(() => {
    applySession(readSessionHints(), "hint");

    if (consumeIdentityChangedNotice()) {
      toast({
        title: "Se inició sesión con otro usuario",
        description:
          "En este navegador entró otro usuario, así que esta pestaña se actualizó con su sesión.",
      });
    }

    let cancelled = false;
    let retryTimer: number | null = null;
    let attempt = 0;
    let wasUnavailable = false;

    const endSession = () => {
      setRestoreStatus("ended");
      clearSession();
      forceLogout({ returnHere: true });
    };

    const restore = async () => {
      retryTimer = null;
      // The backend sets/clears `hasSession` together with the refresh token,
      // so without it there is nothing to restore: skip the request (a
      // guaranteed 401) on a cold /login.
      if (!readClientCookie("hasSession")) {
        endSession();
        return;
      }

      const epoch = getSessionEpoch();
      const result = await refreshSessionIfNeeded(0);
      if (cancelled) return;
      // The user logged in while this page-load refresh was in flight: that
      // login owns the session now; this result is stale.
      if (getSessionEpoch() !== epoch) return;

      if (result === "invalid") {
        endSession();
        return;
      }

      if (result === "unavailable") {
        // Kept, not ended: SessionGate tells the user and offers a retry.
        wasUnavailable = true;
        setRestoreStatus("unavailable");
        retryTimer = window.setTimeout(restore, restoreRetryDelay(attempt));
        attempt += 1;
        return;
      }

      setRestoreStatus("confirmed");
      if (wasUnavailable) {
        toast({ title: "Conexión restablecida" });
      }
    };

    // Back online, or the user asked: retry right away instead of waiting
    // for the next slot.
    const retryNow = () => {
      if (retryTimer === null) return;
      window.clearTimeout(retryTimer);
      setRestoreStatus("checking");
      void restore();
    };
    retryRestoreNow.current = retryNow;

    window.addEventListener("online", retryNow);
    void restore();

    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener("online", retryNow);
    };
  }, [toast]);

  // A logout in another tab ends the session here too: it is the same one.
  useEffect(
    () =>
      subscribeAuthSync((event) => {
        if (event.type === "logout") forceLogout();
      }),
    []
  );

  // Switching branch only changes the working context, never the
  // authorization: the backend's BranchScopeGuard validates x-branch-id on
  // every request, for every role. So no new token is needed — and
  // /auth/switch-branch is no longer called (docs/design/01 §12.4, R7).
  // The page then reloads (effect below), so the new branch starts clean.
  const switchBranch = useCallback(async (id: string) => {
    selectBranch(id);
  }, []);

  // Any move from one branch to another reloads this tab, whether the user
  // chose it or a refresh revoked the current branch: nothing of the previous
  // branch may stay on screen or in a cache (lib/active-branch.ts).
  useEffect(() => reloadOnBranchSwitch(() => window.location.reload()), []);

  useEffect(() => {
    if (isPosRoute) return;
    if (typeof window === "undefined") return;
    // Only renew a confirmed session; restoring one is the page-load effect's job.
    if (!hasToken) return;

    const refreshIntervalMs = 5 * 60 * 1000;
    let destroyed = false;

    // Renews ahead of expiry; the new token reaches React through lib/session.ts.
    const maybeRefresh = () => {
      if (destroyed) return;
      void refreshSessionIfNeeded(refreshIntervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      maybeRefresh();
    };
    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intervalId = window.setInterval(maybeRefresh, 60_000);

    maybeRefresh();

    return () => {
      destroyed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasToken, isPosRoute]);

  const logout = useCallback(async () => {
    try {
      await backendApi.auth.logout();
    } catch {
      // ignore logout API errors, continue local cleanup
    }

    emitAuthSync("logout");
    forceLogout();
  }, []);

  useIdleLogout({
    enabled: hasToken,
    keepAlive: isPosRoute,
    timeoutMs: IDLE_LOGOUT_TIMEOUT_MS,
    onWarn: () => {
      toast({
        title: "Tu sesión está por cerrarse",
        description: "No detectamos actividad. Mové el mouse o tocá la pantalla para seguir conectado.",
      });
    },
    onIdle: () => {
      void logout();
    },
  });

  const value = useMemo(
    () => ({
      currentUser,
      token: session.accessToken,
      branchId,
      branches: session.branches,
      needsOnboarding: session.needsOnboarding,
      setAvatar,
      switchBranch,
      logout,
    }),
    [
      currentUser,
      session.accessToken,
      branchId,
      session.branches,
      session.needsOnboarding,
      setAvatar,
      switchBranch,
      logout,
    ]
  );

  // The app only renders with a confirmed session. Without one it would show
  // the hint user in the menu and every figure at $0 — misleading for a
  // cashier — while requests can't succeed anyway.
  const showGate = !hasToken && !isPublicRoute(pathname);

  return (
    <UserContext.Provider value={value}>
      {showGate ? (
        <SessionGate
          status={restoreStatus}
          onRetry={() => retryRestoreNow.current()}
        />
      ) : (
        children
      )}
    </UserContext.Provider>
  );
}

/**
 * Remounts everything below it when the active branch changes, so no screen
 * can keep showing (or keep in local state) data from the previous branch —
 * e.g. SWR's keepPreviousData would otherwise display branch A's numbers
 * under branch B while B loads. The SWR cache itself is keyed by branch, so
 * switching back is still instant.
 */
export function ActiveBranchBoundary({ children }: { children: React.ReactNode }) {
  const { branchId } = useUser();
  const pathname = usePathname();
  // Public routes show no branch data. Remounting them would wipe their
  // state: signing in sets the active branch, and the login page would lose
  // its spinner and show the form again while the navigation is still on its
  // way (seconds, the first time a route compiles in dev).
  if (isPublicRoute(pathname)) return <>{children}</>;
  return <React.Fragment key={branchId ?? "no-branch"}>{children}</React.Fragment>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
}
