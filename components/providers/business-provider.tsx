"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
  setBusinessType: (type: BusinessType) => void;
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
  const { branchId, branches } = useUser();
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

  const setBusinessType = (type: BusinessType) => {
    setBusinessTypeState(type);
    if (typeof window !== "undefined") {
      localStorage.setItem("businessType", type);
    }
  };

  return (
    <BranchContext.Provider
      value={{
        activeBranchId,
        availableBranches,
        businessType,
        setBusinessType,
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
