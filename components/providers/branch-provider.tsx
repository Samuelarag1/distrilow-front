"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAudit } from "./audit-provider";
import { apiClientFetch } from "@/lib/api-client";
import { useUser } from "./user-provider";

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
  branchType: string;
  createdAt: Date;
  code: string;
}

export interface BranchType {
  WAREHOUSE: "warehouse";
  STORE: "store";
}

interface BranchContextType {
  code: string;
  branchType: BranchType;
  branches: Branch[];
  isLoading: boolean;
  activeBranch: Branch | null;
  setActiveBranch: (branch: Branch | null) => void;
  addBranch: (branch: Omit<Branch, "id" | "createdAt">) => Promise<void>;
  updateBranch: (id: string, branchData: Partial<Branch>) => Promise<void>;
  removeBranch: (id: string) => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [code] = useState<string>("");
  const [branchType] = useState<BranchType>({
    WAREHOUSE: "warehouse",
    STORE: "store",
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const { logEvent } = useAudit();
  const {
    token,
    branchId,
    setBranchId,
    setBranches: setUserBranches,
  } = useUser();

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
        const data = await apiClientFetch.get<Branch[]>("/branches");
        setBranches(data);
        syncUserBranches(data);

        if (branchId) {
          const savedBranch = data.find((b) => b.id === branchId);
          if (savedBranch) {
            setActiveBranch(savedBranch);
          } else if (data.length > 0) {
            setActiveBranch(data[0]);
            setBranchId(data[0].id);
          }
        } else if (data.length > 0) {
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
  }, [token, branchId, setBranchId, setUserBranches]);

  const addBranch = async (branchData: Omit<Branch, "id" | "createdAt">) => {
    try {
      const newBranch = await apiClientFetch.post<Branch>("/branches", branchData);
      logEvent("create", "branch", `Creo nueva sucursal: ${newBranch.name}`, newBranch.id);
      setBranches((prev) => {
        const next = [...prev, newBranch];
        syncUserBranches(next);
        return next;
      });
    } catch (error) {
      console.error("Error creating branch:", error);
      throw error;
    }
  };

  const updateBranch = async (id: string, branchData: Partial<Branch>) => {
    const branch = branches.find((b) => b.id === id);
    try {
      const updatedBranch = await apiClientFetch.put<Branch>(
        `/branches/${id}`,
        branchData
      );
      if (branch) {
        logEvent("update", "branch", `Modifico sucursal ${branch.name}`, id, {
          branchData,
        });
      }
      setBranches((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, ...updatedBranch } : b));
        syncUserBranches(next);
        return next;
      });
      if (activeBranch?.id === id) {
        setActiveBranch({ ...activeBranch, ...updatedBranch });
      }
    } catch (error) {
      console.error("Error updating branch:", error);
    }
  };

  const removeBranch = async (id: string) => {
    const branch = branches.find((b) => b.id === id);
    try {
      await apiClientFetch.delete(`/branches/${id}`);
      if (branch) {
        logEvent("delete", "branch", `Elimino sucursal ${branch.name}`, id);
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
    } catch (error) {
      console.error("Error removing branch:", error);
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
