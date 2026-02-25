"use client";

import { setApiSession } from "@/lib/api-client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface User {
  id: string;
  email?: string;
  name?: string;
  role: "admin" | "cashier" | "manager";
  avatar?: string;
}

export type Branch = { id: string; name: string; isDefault?: boolean };

interface UserContextType {
  token: string | null;
  currentUser: User | null;

  branchId: string | null; // activeBranchId
  branches: Branch[];
  needsOnboarding: boolean;

  setToken: (t: string | null) => void;
  setCurrentUser: (u: User | null) => void;

  setBranchId: (id: string | null) => void;
  setBranches: (b: Branch[]) => void;
  setNeedsOnboarding: (v: boolean) => void;

  logout: () => void;
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

  // ✅ branch activo real
  const [branchId, setBranchId] = useState<string | null>(null);

  // ✅ branches del login
  const [branches, setBranches] = useState<Branch[]>([]);

  // ✅ onboarding si no hay branches
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);

  // 🔁 bootstrap desde cookies (reload)
  useEffect(() => {
    const tokenCookie = getCookie("token");
    const userCookie = getCookie("user");

    // ⚠️ usá un nombre consistente: activeBranchId (recomendado)
    const activeBranchCookie =
      getCookie("activeBranchId") ?? getCookie("branchId");

    const branchesCookie = getCookie("branches");
    const onboardingCookie = getCookie("needsOnboarding");

    if (userCookie) {
      try {
        setCurrentUser(JSON.parse(decodeURIComponent(userCookie)));
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

      // ✅ importantísimo: setea Authorization + X-Branch-Id (si hay)
      setApiSession(tokenCookie, activeBranchCookie || undefined);
    }
  }, []);

  // ✅ si cambia branch o token, actualizás el api client y persistís
  useEffect(() => {
    if (!token) return;
    setApiSession(token, branchId || undefined);
    document.cookie = `activeBranchId=${branchId ?? ""}; path=/`;
  }, [token, branchId]);

  const logout = () => {
    const expire = "expires=Thu, 01 Jan 1970 00:00:00 UTC";
    document.cookie = `token=; path=/; ${expire}`;
    document.cookie = `user=; path=/; ${expire}`;
    document.cookie = `branches=; path=/; ${expire}`;
    document.cookie = `activeBranchId=; path=/; ${expire}`;
    document.cookie = `needsOnboarding=; path=/; ${expire}`;

    setCurrentUser(null);
    setToken(null);
    setBranchId(null);
    setBranches([]);
    setNeedsOnboarding(false);

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
