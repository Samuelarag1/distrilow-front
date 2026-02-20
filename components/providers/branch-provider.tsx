"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useAudit } from "./audit-provider"
import { api } from "@/lib/api-client"
import { useUser } from "./user-provider"

export interface Branch {
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    status: "active" | "inactive";
    createdAt: Date;
}

interface BranchContextType {
    branches: Branch[]
    isLoading: boolean
    activeBranch: Branch | null
    setActiveBranch: (branch: Branch | null) => void
    addBranch: (branch: Omit<Branch, "id" | "createdAt">) => Promise<void>
    updateBranch: (id: string, branchData: Partial<Branch>) => Promise<void>
    removeBranch: (id: string) => Promise<void>
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

export function BranchProvider({ children }: { children: React.ReactNode }) {
    const [branches, setBranches] = useState<Branch[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeBranch, setActiveBranch] = useState<Branch | null>(null)
    const { logEvent } = useAudit()
    const { token, branchId } = useUser()

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                setIsLoading(true);
                const data = await api.get("/branches");
                setBranches(data);

                // If there's a branchId in the user session, set it as active
                if (branchId) {
                    const savedBranch = data.find((b: Branch) => b.id === branchId);
                    if (savedBranch) setActiveBranch(savedBranch);
                } else if (data.length > 0) {
                    setActiveBranch(data[0]);
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
    }, [token, branchId])

    const addBranch = async (branchData: Omit<Branch, "id" | "createdAt">) => {
        try {
            const newBranch = await api.post("/branches", branchData);
            logEvent("create", "branch", `Creó nueva sucursal: ${newBranch.name}`, newBranch.id)
            setBranches(prev => [...prev, newBranch])
        } catch (error) {
            console.error("Error creating branch:", error);
            throw error;
        }
    }

    const updateBranch = async (id: string, branchData: Partial<Branch>) => {
        const branch = branches.find(b => b.id === id)
        try {
            const updatedBranch = await api.put(`/branches/${id}`, branchData);
            if (branch) {
                logEvent("update", "branch", `Modificó detalles de sucursal ${branch.name}`, id, { branchData })
            }
            setBranches(prev => prev.map(b => b.id === id ? { ...b, ...updatedBranch } : b))
            if (activeBranch?.id === id) {
                setActiveBranch({ ...activeBranch, ...updatedBranch });
            }
        } catch (error) {
            console.error("Error updating branch:", error);
        }
    }

    const removeBranch = async (id: string) => {
        const branch = branches.find(b => b.id === id)
        try {
            await api.delete(`/branches/${id}`);
            if (branch) {
                logEvent("delete", "branch", `Eliminó la sucursal ${branch.name}`, id)
            }
            setBranches(prev => prev.filter(b => b.id !== id))
            if (activeBranch?.id === id) {
                setActiveBranch(branches.find(b => b.id !== id) || null)
            }
        } catch (error) {
            console.error("Error removing branch:", error);
        }
    }

    return (
        <BranchContext.Provider value={{
            branches,
            isLoading,
            activeBranch,
            setActiveBranch,
            addBranch,
            updateBranch,
            removeBranch
        }}>
            {children}
        </BranchContext.Provider>
    )
}

export function useBranches() {
    const context = useContext(BranchContext)
    if (context === undefined) {
        throw new Error("useBranches must be used within a BranchProvider")
    }
    return context
}
