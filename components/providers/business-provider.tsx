"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { setApiSession } from "@/lib/api-client";

export interface Branch {
  id: string;
  name: string;
  isDefault?: boolean;
}

interface BranchContextType {
  activeBranchId: string | null;
  availableBranches: Branch[];
  setActiveBranch: (branchId: string) => void;
  setSessionBranches: (branches: Branch[], activeId: string | null) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (activeBranchId) {
      setApiSession(localStorage.getItem("token")!, activeBranchId);
      localStorage.setItem("activeBranchId", activeBranchId);
    }
  }, [activeBranchId]);

  const setActiveBranch = (branchId: string) => {
    setActiveBranchId(branchId);
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
        setActiveBranch,
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
