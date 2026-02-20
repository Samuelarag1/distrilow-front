"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useAudit } from "./audit-provider"

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
    activeBranch: Branch | null
    setActiveBranch: (branch: Branch | null) => void
    addBranch: (branch: Omit<Branch, "id" | "createdAt">) => void
    updateBranch: (id: string, branchData: Partial<Branch>) => void
    removeBranch: (id: string) => void
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

const initialBranches: Branch[] = [
    {
        id: "b1",
        name: "Sucursal Central",
        address: "Av. Principal 123",
        phone: "555-0101",
        email: "central@negocio.com",
        status: "active",
        createdAt: new Date()
    },
    {
        id: "b2",
        name: "Sucursal Norte",
        address: "Calle Norte 456",
        phone: "555-0102",
        email: "norte@negocio.com",
        status: "active",
        createdAt: new Date()
    }
]

export function BranchProvider({ children }: { children: React.ReactNode }) {
    const [branches, setBranches] = useState<Branch[]>(initialBranches)
    const [activeBranch, setActiveBranch] = useState<Branch | null>(initialBranches[0])
    const { logEvent } = useAudit()

    const addBranch = (branchData: Omit<Branch, "id" | "createdAt">) => {
        const newBranch: Branch = {
            ...branchData,
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date()
        }
        logEvent("create", "branch", `Creó nueva sucursal: ${newBranch.name}`, newBranch.id)
        setBranches(prev => [...prev, newBranch])
    }

    const updateBranch = (id: string, branchData: Partial<Branch>) => {
        const branch = branches.find(b => b.id === id)
        if (branch) {
            logEvent("update", "branch", `Modificó detalles de sucursal ${branch.name}`, id, { branchData })
        }
        setBranches(prev => prev.map(b => b.id === id ? { ...b, ...branchData } : b))
    }

    const removeBranch = (id: string) => {
        const branch = branches.find(b => b.id === id)
        if (branch) {
            logEvent("delete", "branch", `Eliminó la sucursal ${branch.name}`, id)
        }
        setBranches(prev => prev.filter(b => b.id !== id))
        if (activeBranch?.id === id) {
            setActiveBranch(branches.find(b => b.id !== id) || null)
        }
    }

    return (
        <BranchContext.Provider value={{
            branches,
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
