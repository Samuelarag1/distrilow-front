"use client";

import { setApiSession } from "@/lib/api-client";
import { backendApi } from "@/lib/backend-api";
import { clearSessionCookies, setClientCookie } from "@/lib/client-cookies";
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

  setBranchId: (id: string | null) => void;
  setBranches: (b: Branch[]) => void;
  setNeedsOnboarding: (v: boolean) => void;
  switchBranch: (id: string) => Promise<void>;

  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

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

function writeSessionCookies(payload: {
  accessToken?: string | null;
  branches?: Branch[];
  activeBranchId?: string | null;
  needsOnboarding?: boolean;
}) {
  if (payload.accessToken !== undefined && payload.accessToken !== null) {
    setClientCookie("accessToken", payload.accessToken);
  }

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);

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
        setCurrentUser({
          ...parsed,
          name: parsed.name ?? parsed.email,
        });
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
    }

    if (!activeBranchCookie && resolvedBranchId) {
      setClientCookie("activeBranchId", resolvedBranchId);
    }
  }, []);

  useEffect(() => {
    setApiSession({ accessToken: token, branchId: branchId ?? undefined });
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
        accessToken: token,
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
      accessToken: nextToken,
      branches: nextBranches,
      activeBranchId: nextBranchId,
      needsOnboarding: nextNeedsOnboarding,
    });
  }, [branchId, token, branches, needsOnboarding, currentUser?.role]);

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
      setToken,
      setBranchId,
      setBranches,
      setNeedsOnboarding,
      switchBranch,
      logout,
    }),
    [currentUser, token, branchId, branches, needsOnboarding, switchBranch]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
}
