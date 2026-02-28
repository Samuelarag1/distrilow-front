"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
  setActiveBranch: (branch: Branch | null) => void;
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
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const { logEvent } = useAudit();
  const { token, branchId, setBranchId, setBranches: setUserBranches } = useUser();

  const syncUserBranches = (rows: Branch[]) => {
    setUserBranches(
      rows.map((b) => ({
        id: b.id,
        name: b.name,
      }))
    );
  };

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setIsLoading(true);
        const response = await backendApi.branches.list();
        const data = response.map(normalizeBranch);
        setBranches(data);
        syncUserBranches(data);

        if (branchId) {
          const savedBranch = data.find((b) => b.id === branchId);
          if (savedBranch) {
            setActiveBranch(savedBranch);
            return;
          }
        }

        if (data.length > 0) {
          setActiveBranch(data[0]);
          setBranchId(data[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch branches:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchBranches();
    }
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
      const next = [...prev, created];
      syncUserBranches(next);
      return next;
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

    setBranches((prev) => {
      const next = prev.map((b) => (b.id === id ? updated : b));
      syncUserBranches(next);
      return next;
    });

    if (activeBranch?.id === id) {
      setActiveBranch(updated);
    }
  };

  const removeBranch = async (id: string) => {
    const existing = branches.find((b) => b.id === id);
    await backendApi.branches.remove(id);

    if (existing) {
      logEvent("delete", "branch", `Elimino sucursal ${existing.name}`, id);
    }

    setBranches((prev) => {
      const next = prev.filter((b) => b.id !== id);
      syncUserBranches(next);
      return next;
    });

    if (activeBranch?.id === id) {
      const fallback = branches.find((b) => b.id !== id) || null;
      setActiveBranch(fallback);
      setBranchId(fallback?.id ?? null);
    }
  };

  return (
    <BranchContext.Provider
      value={{
        branchType,
        code,
        branches,
        isLoading,
        activeBranch,
        setActiveBranch,
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
