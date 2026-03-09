"use client";

import {
  getLastRefreshPayload,
  getApiSession,
  refreshSessionIfNeeded,
  setApiSession,
} from "@/lib/api-client";
import { backendApi } from "@/lib/backend-api";
import {
  clearSessionCookies,
  setClientCookie,
  syncClientAuthCookies,
} from "@/lib/client-cookies";
import { isManagementRole } from "@/lib/permissions";
import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SessionBranch, UserRole } from "@/lib/api-types";

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

function normalizeSessionBranches(input: unknown): Branch[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((raw, index) => {
      if (typeof raw === "string") {
        const id = raw.trim();
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
        (typeof value.id === "string" && value.id.trim()) ||
        (typeof value.branchId === "string" && value.branchId.trim()) ||
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
    setClientCookie("branches", JSON.stringify(payload.branches));
  }

  if (payload.activeBranchId !== undefined) {
    setClientCookie("activeBranchId", payload.activeBranchId ?? "");
  }

  if (payload.needsOnboarding !== undefined) {
    setClientCookie("needsOnboarding", payload.needsOnboarding);
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);

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
    setClientCookie("user", JSON.stringify(hydrated));
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
      setClientCookie("user", JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const tokenCookie =
      getCookie("token") ?? getCookie("accessToken") ?? getCookie("access_token");
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

    const resolvedBranchId = activeBranchCookie || parsedBranches[0]?.id || null;
    setBranchId(resolvedBranchId);

    if (tokenCookie) {
      setToken(tokenCookie);
      setApiSession({ accessToken: tokenCookie, branchId: resolvedBranchId ?? undefined });
      return;
    }

    if (!activeBranchCookie && resolvedBranchId) {
      setClientCookie("activeBranchId", resolvedBranchId);
    }

    let cancelled = false;

    const bootstrapFromRefresh = async () => {
      const refreshed = await refreshSessionIfNeeded(0);
      if (!refreshed || cancelled) return;

      const payload = getLastRefreshPayload();
      const session = getApiSession();
      const refreshedToken = session.accessToken ?? payload?.accessToken ?? null;
      const refreshedBranches = normalizeSessionBranches(
        payload?.session?.availableBranches ?? parsedBranches
      );
      const refreshedBranchId =
        payload?.session?.activeBranchId ??
        session.branchId ??
        resolvedBranchId ??
        refreshedBranches[0]?.id ??
        null;
      const refreshedNeedsOnboarding =
        payload?.session?.needsOnboarding ??
        (onboardingCookie ? onboardingCookie === "true" : false);

      syncClientAuthCookies({
        accessToken: refreshedToken,
        refreshToken: payload?.refreshToken,
      });

      if (payload?.user) {
        const hydratedUser = hydrateUserAvatar({
          ...payload.user,
          name: payload.user.email,
        });
        setCurrentUserState(hydratedUser);
        setClientCookie("user", JSON.stringify(hydratedUser));
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
    };

    void bootstrapFromRefresh();

    return () => {
      cancelled = true;
    };
  }, [hydrateUserAvatar]);

  useEffect(() => {
    setApiSession({ accessToken: token, branchId: branchId ?? undefined });
    syncClientAuthCookies({ accessToken: token });
    if (branchId !== undefined) {
      setClientCookie("activeBranchId", branchId ?? "");
    }
  }, [token, branchId]);

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
    const nextBranchId = response.session?.activeBranchId ?? id;
    const nextNeedsOnboarding =
      response.session?.needsOnboarding ?? needsOnboarding;

    syncClientAuthCookies({
      accessToken: nextToken,
      refreshToken: response.refreshToken,
    });

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
  }, [branchId, token, branches, needsOnboarding, currentUser?.role]);

  useEffect(() => {
    if (!currentUser) return;
    if (typeof window === "undefined") return;

    const refreshIntervalMs = 11 * 60 * 1000;
    const activeWindowMs = 2 * 60 * 1000;
    let destroyed = false;
    let lastActivityAt = Date.now();

    const markActivity = () => {
      lastActivityAt = Date.now();
    };

    const maybeRefresh = async () => {
      if (destroyed) return;
      if (Date.now() - lastActivityAt > activeWindowMs) return;

      const refreshed = await refreshSessionIfNeeded(refreshIntervalMs);
      if (!refreshed || destroyed) return;

      const session = getApiSession();
      if (session.accessToken && session.accessToken !== token) {
        setToken(session.accessToken);
      }
      if (session.branchId && session.branchId !== branchId) {
        setBranchId(session.branchId);
      }
    };

    const handleFocus = () => {
      markActivity();
      void maybeRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      markActivity();
      void maybeRefresh();
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true });
    });
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
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
    };
  }, [currentUser, token, branchId]);

  const logout = async () => {
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
  };

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
    ]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
}
