"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { setApiSession } from "@/lib/api-client";
import { BusinessType } from "@/lib/data-service";

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
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [businessType, setBusinessTypeState] = useState<BusinessType>("retail");

  useEffect(() => {
    if (activeBranchId) {
      setApiSession(localStorage.getItem("token")!, activeBranchId);
      localStorage.setItem("activeBranchId", activeBranchId);
    }
  }, [activeBranchId]);

  useEffect(() => {
    const activeBranch =
      availableBranches.find((branch) => branch.id === activeBranchId) ?? null;
    const inferredType = inferBusinessType(activeBranch);
    setBusinessTypeState(inferredType);
    localStorage.setItem("businessType", inferredType);
  }, [activeBranchId, availableBranches]);

  const setActiveBranch = (branchId: string) => {
    setActiveBranchId(branchId);
  };

  const setBusinessType = (type: BusinessType) => {
    setBusinessTypeState(type);
    localStorage.setItem("businessType", type);
  };

  const setSessionBranches = (branches: Branch[], activeId: string | null) => {
    setAvailableBranches(branches);
    setActiveBranchId(activeId);
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
  if (!context) throw new Error("useBranch must be used within BranchProvider");
  return context;
}

// Backward-compatible API for modules that still consume `useBusiness`.
export function useBusiness() {
  return useBranch();
}
