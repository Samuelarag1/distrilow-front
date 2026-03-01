"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { setApiSession } from "@/lib/api-client";
import type { BusinessType } from "@/lib/data-service";
import { useUser } from "./user-provider";

export interface Branch {
  id: string;
  name: string;
  code?: string;
  branchType?: string;
  type?: string;
  isDefault?: boolean;
}

interface BranchContextType {
  activeBranchId: string | null;
  availableBranches: Branch[];
  businessType: BusinessType;
  setActiveBranch: (branchId: string) => void;
  setBusinessType: (type: BusinessType) => void;
  setSessionBranches: (branches: Branch[], activeId: string | null) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

function inferBusinessType(branch: Branch | null): BusinessType {
  if (!branch) return "retail";
  const haystack = `${branch.name} ${branch.code ?? ""} ${
    branch.branchType ?? branch.type ?? ""
  }`.toLowerCase();
  const wholesaleHints = ["wholesale", "mayorista", "warehouse", "bodega"];
  return wholesaleHints.some((hint) => haystack.includes(hint))
    ? "wholesale"
    : "retail";
}

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const {
    token,
    branchId,
    branches,
    setBranchId,
    switchBranch,
    setBranches: setUserBranches,
  } = useUser();
  const [businessType, setBusinessTypeState] = useState<BusinessType>(() => {
    if (typeof window === "undefined") return "retail";
    const saved = localStorage.getItem("businessType");
    return saved === "wholesale" || saved === "retail" ? saved : "retail";
  });

  const activeBranchId = branchId;
  const availableBranches = branches;

  useEffect(() => {
    const activeBranch =
      availableBranches.find((branch) => branch.id === activeBranchId) ?? null;
    const inferredType = inferBusinessType(activeBranch);
    setBusinessTypeState((prev) => (prev === inferredType ? prev : inferredType));
    if (typeof window !== "undefined") {
      localStorage.setItem("businessType", inferredType);
    }
  }, [activeBranchId, availableBranches]);

  const setActiveBranch = (branchId: string) => {
    void switchBranch(branchId);
  };

  const setBusinessType = (type: BusinessType) => {
    setBusinessTypeState(type);
    if (typeof window !== "undefined") {
      localStorage.setItem("businessType", type);
    }
  };

  const setSessionBranches = (branches: Branch[], activeId: string | null) => {
    setUserBranches(branches);
    setBranchId(activeId);
    if (token) setApiSession({ accessToken: token, branchId: activeId ?? null });
  };

  return (
    <BranchContext.Provider
      value={{
        activeBranchId,
        availableBranches,
        businessType,
        setActiveBranch,
        setBusinessType,
        setSessionBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) throw new Error("useBranch must be used within BusinessProvider");
  return context;
}

// Backward-compatible API for modules that still consume `useBusiness`.
export function useBusiness() {
  return useBranch();
}
