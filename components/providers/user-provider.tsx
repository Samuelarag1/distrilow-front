"use client";

import { usePathname } from "next/navigation";
import {
  forceLogout,
  getLastRefreshPayload,
  getApiSession,
  refreshSessionIfNeeded,
  setApiSession,
} from "@/lib/api-client";
import { backendApi } from "@/lib/backend-api";
import {
  clearSessionCookies,
  setPersistentSessionCookie,
} from "@/lib/client-cookies";
import { isManagementRole } from "@/lib/permissions";
import { useIdleLogout } from "@/hooks/use-idle-logout";
import { useToast } from "@/hooks/use-toast";
import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SessionBranch, UserRole } from "@/lib/api-types";

// 20 min of no mouse/keyboard/touch/scroll activity anywhere in the app
// (including POS — an unattended, still-logged-in terminal is the case
// this exists to close) logs the session out automatically. Override with
// NEXT_PUBLIC_IDLE_TIMEOUT_MS for a different site-wide value.
const IDLE_LOGOUT_TIMEOUT_MS =
  Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS) || 20 * 60 * 1000;

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

  setToken: (t: string | null) => void;
  setCurrentUser: (u: User | null) => void;
  setAvatar: (avatar: string | null) => void;

  setBranchId: (id: string | null) => void;
  setBranches: (b: Branch[]) => void;
  setNeedsOnboarding: (v: boolean) => void;
  switchBranch: (id: string) => Promise<void>;

  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);
const USER_AVATAR_STORE_KEY = "user-avatar-by-id";

function normalizeBranchIdValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;

  return trimmed;
}

function normalizeSessionBranches(input: unknown): Branch[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((raw, index) => {
      if (typeof raw === "string") {
        const id = normalizeBranchIdValue(raw);
        if (!id) return null;
        return { id, name: `Sucursal ${index + 1}` } satisfies Branch;
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
      } satisfies Branch;
    })
    .filter((branch): branch is Branch => Boolean(branch));
}

function getCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.split("=").slice(1).join("=");

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readAvatarStore(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(USER_AVATAR_STORE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed as Record<string, unknown>).reduce(
      (acc, [key, value]) => {
        if (typeof value === "string" && value.trim()) {
          acc[key] = value.trim();
        }
        return acc;
      },
      {} as Record<string, string>
    );
  } catch {
    return {};
  }
}

function writeAvatarStore(store: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_AVATAR_STORE_KEY, JSON.stringify(store));
}

function writeSessionCookies(payload: {
  branches?: Branch[];
  activeBranchId?: string | null;
  needsOnboarding?: boolean;
}) {
  if (payload.branches) {
    setPersistentSessionCookie("branches", JSON.stringify(payload.branches));
  }

  if (payload.activeBranchId !== undefined) {
    setPersistentSessionCookie("activeBranchId", payload.activeBranchId ?? "");
  }

  if (payload.needsOnboarding !== undefined) {
    setPersistentSessionCookie("needsOnboarding", payload.needsOnboarding);
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toast } = useToast();
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const [sessionBootstrapped, setSessionBootstrapped] = useState(false);
  const isPosRoute = pathname === "/pos" || pathname.startsWith("/pos/");

  const hydrateUserAvatar = useCallback((input: User): User => {
    const normalized: User = {
      ...input,
      name: input.name ?? input.email,
    };
    if (!normalized.id) return normalized;

    const stored = readAvatarStore()[normalized.id];
    if (!normalized.avatar && stored) {
      return {
        ...normalized,
        avatar: stored,
      };
    }

    return normalized;
  }, []);

  const setCurrentUser = useCallback((user: User | null) => {
    if (!user) {
      setCurrentUserState(null);
      return;
    }

    const hydrated = hydrateUserAvatar(user);
    setCurrentUserState(hydrated);
    setPersistentSessionCookie("user", JSON.stringify(hydrated));
  }, [hydrateUserAvatar]);

  const setAvatar = useCallback((avatar: string | null) => {
    setCurrentUserState((prev) => {
      if (!prev) return prev;

      const normalizedAvatar = avatar?.trim() || undefined;
      const next = {
        ...prev,
        avatar: normalizedAvatar,
      };

      const store = readAvatarStore();
      if (normalizedAvatar) {
        store[prev.id] = normalizedAvatar;
      } else {
        delete store[prev.id];
      }
      writeAvatarStore(store);
      setPersistentSessionCookie("user", JSON.stringify(next));
      return next;
    });
  }, []);

  const setBranchId = useCallback((id: string | null) => {
    setBranchIdState(normalizeBranchIdValue(id));
  }, []);

  useEffect(() => {
    setSessionBootstrapped(false);

    // accessToken is httpOnly now — there is no cookie to read here. Every
    // fresh page load must ask the backend to confirm the session via the
    // httpOnly refresh cookie instead of trusting a client-visible value.
    const userCookie = getCookie("user");
    const activeBranchCookie =
      getCookie("activeBranchId") ?? getCookie("branchId");
    const branchesCookie = getCookie("branches");
    const onboardingCookie = getCookie("needsOnboarding");
    let parsedBranches: Branch[] = [];

    if (userCookie) {
      try {
        const parsed = JSON.parse(userCookie);
        setCurrentUserState(hydrateUserAvatar({
          ...parsed,
          name: parsed.name ?? parsed.email,
        }));
      } catch (err) {
        console.error("Error parsing user cookie:", err);
      }
    }

    if (branchesCookie) {
      try {
        parsedBranches = normalizeSessionBranches(JSON.parse(branchesCookie));
        setBranches(parsedBranches);
      } catch (err) {
        console.error("Error parsing branches cookie:", err);
      }
    }

    if (onboardingCookie) {
      setNeedsOnboarding(onboardingCookie === "true");
    }

    const resolvedBranchId =
      normalizeBranchIdValue(activeBranchCookie) ??
      parsedBranches[0]?.id ??
      null;
    setBranchId(resolvedBranchId);

    if (!activeBranchCookie && resolvedBranchId) {
      setPersistentSessionCookie("activeBranchId", resolvedBranchId);
    }

    let cancelled = false;

    const bootstrapFromRefresh = async () => {
      try {
        const refreshed = await refreshSessionIfNeeded(0);
        if (cancelled) return;

        if (!refreshed) {
          // No valid session at all — don't leave the UI hydrated from a
          // stale "user" cookie pretending someone is still logged in.
          clearSessionCookies();
          setCurrentUserState(null);
          setToken(null);
          setBranches([]);
          setBranchId(null);
          setNeedsOnboarding(false);
          forceLogout();
          return;
        }

        const payload = getLastRefreshPayload();
        const session = getApiSession();
        const refreshedToken = session.accessToken ?? payload?.accessToken ?? null;
        const refreshedBranches = normalizeSessionBranches(
          payload?.session?.availableBranches ?? parsedBranches
        );
        const refreshedBranchId =
          normalizeBranchIdValue(payload?.session?.activeBranchId) ??
          normalizeBranchIdValue(session.branchId) ??
          normalizeBranchIdValue(resolvedBranchId) ??
          normalizeBranchIdValue(refreshedBranches[0]?.id) ??
          null;
        const refreshedNeedsOnboarding =
          payload?.session?.needsOnboarding ??
          (onboardingCookie ? onboardingCookie === "true" : false);

        if (payload?.user) {
          const hydratedUser = hydrateUserAvatar({
            ...payload.user,
            name: payload.user.email,
          });
          setCurrentUserState(hydratedUser);
          setPersistentSessionCookie("user", JSON.stringify(hydratedUser));
        }

        setToken(refreshedToken);
        setBranches(refreshedBranches);
        setBranchId(refreshedBranchId);
        setNeedsOnboarding(refreshedNeedsOnboarding);

        setApiSession({
          accessToken: refreshedToken,
          branchId: refreshedBranchId ?? undefined,
        });

        writeSessionCookies({
          branches: refreshedBranches,
          activeBranchId: refreshedBranchId,
          needsOnboarding: refreshedNeedsOnboarding,
        });
      } finally {
        if (!cancelled) {
          setSessionBootstrapped(true);
        }
      }
    };

    void bootstrapFromRefresh();

    return () => {
      cancelled = true;
    };
  }, [hydrateUserAvatar, setBranchId]);

  useEffect(() => {
    if (!sessionBootstrapped) return;

    setApiSession({ accessToken: token, branchId: branchId ?? undefined });
    if (branchId !== undefined) {
      setPersistentSessionCookie("activeBranchId", branchId ?? "");
    }
  }, [token, branchId, sessionBootstrapped]);

  const switchBranch = useCallback(async (id: string) => {
    if (!id) return;
    if (id === branchId) return;
    if (branches.length > 0 && !branches.some((branch) => branch.id === id)) {
      throw new Error("No tienes acceso a la sucursal seleccionada.");
    }

    const applyLocalBranchSelection = (nextBranchId: string) => {
      setBranchId(nextBranchId);
      setApiSession({
        accessToken: token,
        branchId: nextBranchId,
      });
      writeSessionCookies({
        branches,
        activeBranchId: nextBranchId,
        needsOnboarding,
      });
    };

    // Para roles no-management, cambiar sucursal localmente evita depender de
    // /auth/switch-branch, que suele restringirse por rol.
    if (!isManagementRole(currentUser?.role)) {
      applyLocalBranchSelection(id);
      return;
    }

    const response = await backendApi.auth.switchBranch({ branchId: id });

    const nextToken = response.accessToken ?? token;
    const nextBranches = normalizeSessionBranches(
      response.session?.availableBranches ?? branches
    );
    const nextBranchId =
      normalizeBranchIdValue(response.session?.activeBranchId) ??
      normalizeBranchIdValue(id);
    if (!nextBranchId) {
      throw new Error("No se pudo resolver la sucursal activa.");
    }
    const nextNeedsOnboarding =
      response.session?.needsOnboarding ?? needsOnboarding;

    if (nextToken !== token) {
      setToken(nextToken);
    }
    setBranches(nextBranches);
    setBranchId(nextBranchId);
    setNeedsOnboarding(nextNeedsOnboarding);

    setApiSession({
      accessToken: nextToken,
      branchId: nextBranchId,
    });

    writeSessionCookies({
      branches: nextBranches,
      activeBranchId: nextBranchId,
      needsOnboarding: nextNeedsOnboarding,
    });
  }, [branchId, token, branches, needsOnboarding, currentUser?.role, setBranchId]);

  useEffect(() => {
    if (isPosRoute) return;
    if (typeof window === "undefined") return;

    // "hasSession" is the non-secret marker cookie the backend sets
    // alongside the real (httpOnly) tokens — see client-cookies.ts.
    const hasSessionMarker = Boolean(getCookie("hasSession"));
    if (!currentUser && !token && !hasSessionMarker) return;

    const refreshIntervalMs = 5 * 60 * 1000;
    let destroyed = false;

    const maybeRefresh = async () => {
      if (destroyed) return;

      const refreshed = await refreshSessionIfNeeded(refreshIntervalMs);
      if (!refreshed || destroyed) return;

      const session = getApiSession();
      if (session.accessToken && session.accessToken !== token) {
        setToken(session.accessToken);
      }
      const refreshedBranchId = normalizeBranchIdValue(session.branchId);
      if (refreshedBranchId && refreshedBranchId !== branchId) {
        setBranchId(refreshedBranchId);
      }
    };

    const handleFocus = () => {
      void maybeRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void maybeRefresh();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intervalId = window.setInterval(() => {
      void maybeRefresh();
    }, 60_000);

    void maybeRefresh();

    return () => {
      destroyed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUser, token, branchId, setBranchId, isPosRoute]);

  const logout = useCallback(async () => {
    try {
      await backendApi.auth.logout();
    } catch {
      // ignore logout API errors, continue local cleanup
    }

    clearSessionCookies();

    setCurrentUser(null);
    setToken(null);
    setBranchId(null);
    setBranches([]);
    setNeedsOnboarding(false);
    setApiSession({ accessToken: null, branchId: null });

    window.location.href = "/login";
  }, [setCurrentUser, setBranchId]);

  useIdleLogout({
    enabled: Boolean(currentUser),
    timeoutMs: IDLE_LOGOUT_TIMEOUT_MS,
    onWarn: () => {
      toast({
        title: "Tu sesion esta por cerrarse",
        description: "No detectamos actividad. Movete o hace click para seguir conectado.",
      });
    },
    onIdle: () => {
      void logout();
    },
  });

  const value = useMemo(
    () => ({
      currentUser,
      token,
      branchId,
      branches,
      needsOnboarding,
      setCurrentUser,
      setAvatar,
      setToken,
      setBranchId,
      setBranches,
      setNeedsOnboarding,
      switchBranch,
      logout,
    }),
    [
      currentUser,
      token,
      branchId,
      branches,
      needsOnboarding,
      setCurrentUser,
      setAvatar,
      switchBranch,
      logout,
      setBranchId,
    ]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
}
