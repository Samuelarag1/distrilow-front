"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAudit } from "./audit-provider";
import { useUser } from "./user-provider";
import { backendApi } from "@/lib/backend-api";
import type { Branch as ApiBranch, BranchType, CreateBranchRequest } from "@/lib/api-types";

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
  branchType: BranchType;
  createdAt: string;
  code: string;
}

interface BranchContextType {
  code: string;
  branchType: {
    WAREHOUSE: "warehouse";
    STORE: "store";
  };
  branches: Branch[];
  isLoading: boolean;
  activeBranch: Branch | null;
  addBranch: (branch: Omit<Branch, "id" | "createdAt">) => Promise<void>;
  updateBranch: (id: string, branchData: Partial<Branch>) => Promise<void>;
  removeBranch: (id: string) => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

function normalizeBranch(branch: ApiBranch): Branch {
  return {
    id: branch.id,
    code: branch.code,
    name: branch.name,
    address: branch.address,
    phone: branch.phone ?? "",
    email: branch.email ?? "",
    isActive: Boolean(branch.isActive),
    branchType: branch.branchType,
    createdAt: branch.createdAt ?? new Date().toISOString(),
  };
}

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [code] = useState<string>("");
  const [branchType] = useState({
    WAREHOUSE: "warehouse" as const,
    STORE: "store" as const,
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { logEvent } = useAudit();
  const { token, branchId } = useUser();

  // Derived, never stored: the active branch is owned by lib/active-branch.ts.
  // If the list doesn't contain it, there is no active branch here — no
  // fallback to "the first one" (docs/design/01-login-y-sesion.md R2).
  const activeBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId) ?? null,
    [branches, branchId]
  );

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setIsLoading(true);
        const response = await backendApi.branches.list();
        setBranches(response.map(normalizeBranch));
      } catch (error) {
        console.error("Failed to fetch branches:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchBranches();
      return;
    }

    setBranches([]);
    setIsLoading(false);
  }, [token]);

  const addBranch = async (branchData: Omit<Branch, "id" | "createdAt">) => {
    const payload: CreateBranchRequest = {
      code: branchData.code,
      name: branchData.name,
      address: branchData.address,
      branchType: branchData.branchType,
      isActive: branchData.isActive,
      phone: branchData.phone || undefined,
      email: branchData.email || undefined,
    };

    const created = normalizeBranch(await backendApi.branches.create(payload));

    logEvent("create", "branch", `Creo nueva sucursal: ${created.name}`, created.id);

    setBranches((prev) => {
      return [...prev, created];
    });
  };

  const updateBranch = async (id: string, branchData: Partial<Branch>) => {
    const existing = branches.find((b) => b.id === id);
    const updated = normalizeBranch(
      await backendApi.branches.update(id, {
        code: branchData.code,
        name: branchData.name,
        address: branchData.address,
        branchType: branchData.branchType,
        isActive: branchData.isActive,
        phone: branchData.phone,
        email: branchData.email,
      })
    );

    if (existing) {
      logEvent("update", "branch", `Modifico sucursal ${existing.name}`, id, {
        branchData,
      });
    }

    setBranches((prev) => prev.map((b) => (b.id === id ? updated : b)));
  };

  const removeBranch = async (id: string) => {
    const existing = branches.find((b) => b.id === id);
    await backendApi.branches.remove(id);

    if (existing) {
      logEvent("delete", "branch", `Elimino sucursal ${existing.name}`, id);
    }

    // Only a branch with no history can be deleted (the backend answers 409
    // otherwise, B2). If it was the active one, the next token refresh drops
    // it from the user's allowed list and lib/active-branch.ts clears it. No
    // client-side "pick another" guess.
    setBranches((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <BranchContext.Provider
      value={{
        branchType,
        code,
        branches,
        isLoading,
        activeBranch,
        addBranch,
        updateBranch,
        removeBranch,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranches() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranches must be used within a BranchProvider");
  }
  return context;
}
