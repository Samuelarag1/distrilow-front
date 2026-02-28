"use client";

import { setApiSession } from "@/lib/api-client";
import { backendApi } from "@/lib/backend-api";
import React, {
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

  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function getCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=") : null;
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

    if (userCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(userCookie));
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
        setBranches(JSON.parse(decodeURIComponent(branchesCookie)));
      } catch (err) {
        console.error("Error parsing branches cookie:", err);
      }
    }

    if (onboardingCookie) {
      setNeedsOnboarding(onboardingCookie === "true");
    }

    if (activeBranchCookie) {
      setBranchId(activeBranchCookie || null);
    }

    if (tokenCookie) {
      setToken(tokenCookie);
      setApiSession({ accessToken: tokenCookie, branchId: activeBranchCookie || undefined });
    }
  }, []);

  useEffect(() => {
    setApiSession({ accessToken: token, branchId: branchId ?? undefined });
    if (branchId !== undefined) {
      document.cookie = `activeBranchId=${branchId ?? ""}; path=/`;
    }
  }, [token, branchId]);

  const logout = async () => {
    try {
      await backendApi.auth.logout();
    } catch {
      // ignore logout API errors, continue local cleanup
    }

    const expire = "expires=Thu, 01 Jan 1970 00:00:00 UTC";
    document.cookie = `token=; path=/; ${expire}`;
    document.cookie = `accessToken=; path=/; ${expire}`;
    document.cookie = `refreshToken=; path=/; ${expire}`;
    document.cookie = `user=; path=/; ${expire}`;
    document.cookie = `branches=; path=/; ${expire}`;
    document.cookie = `activeBranchId=; path=/; ${expire}`;
    document.cookie = `needsOnboarding=; path=/; ${expire}`;

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
      logout,
    }),
    [currentUser, token, branchId, branches, needsOnboarding]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
}
