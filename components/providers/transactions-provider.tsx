"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { BusinessType } from "@/lib/data-service"
import { useBusiness } from "./business-provider"
import { useAudit } from "./audit-provider"
import { useUser } from "./user-provider"
import { db } from "@/lib/db"
import { useNetworkStatus } from "@/hooks/use-network"

export interface Expense {
    id: string
    amount: number
    category: string
    description: string
    date: string
    businessType: BusinessType
    userId?: string
}

export interface Sale {
    id: string
    amount: number
    customerName: string
    items: number // count
    lineItems?: any[] // details
    date: string
    businessType: BusinessType
    userId: string
    userName: string
    branchId: string
    status?: 'PENDING' | 'COMPLETED'
}

interface TransactionsContextType {
    expenses: Expense[]
    sales: Sale[]
    addExpense: (expense: Omit<Expense, "id" | "date">) => void
    addSale: (sale: Omit<Sale, "id" | "date">) => void
    getExpensesByType: (type: BusinessType) => Expense[]
    getSalesByType: (type: BusinessType) => Sale[]
    getTotalExpensesByType: (type: BusinessType) => number
    getTotalSalesByType: (type: BusinessType) => number
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined)

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [sales, setSales] = useState<Sale[]>([])
    const { logEvent } = useAudit()
    const { currentUser } = useUser()
    const isOnline = useNetworkStatus()

    // Load from DB on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const dbSales = await db.sales.toArray();
                const mappedSales = dbSales.map(s => ({
                    id: s.id,
                    amount: s.total,
                    customerName: "Cliente Local",
                    items: s.items ? s.items.length : 0,
                    lineItems: s.items,
                    date: s.createdAt.toISOString(),
                    businessType: "retail" as BusinessType,
                    userId: s.userId || "unknown",
                    userName: "User",
                    status: s.status === 'PENDING' ? 'PENDING' : 'COMPLETED'
                } as Sale));

                // Sort by date desc
                mappedSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (mappedSales.length > 0) {
                    setSales(mappedSales);
                }
            } catch (e) {
                console.error("Failed to load local sales", e);
            }
        };
        loadData();
    }, []);

    const addExpense = (newExpense: Omit<Expense, "id" | "date">) => {
        const expense: Expense = {
            ...newExpense,
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
            userId: currentUser?.id
        }
        logEvent("create", "expense", `Registró un gasto de $${expense.amount.toLocaleString()}: ${expense.description}`, expense.id)
        setExpenses((prev) => [expense, ...prev])
    }

    const addSale = async (newSale: Omit<Sale, "id" | "date">) => {
        const saleId = crypto.randomUUID();
        const sale: Sale = {
            ...newSale,
            id: saleId,
            date: new Date().toISOString(),
            status: isOnline ? 'COMPLETED' : 'PENDING'
        }

        // Update UI immediately (Optimistic UI)
        setSales((prev) => [sale, ...prev])
        logEvent("create", "sale", `Realizó una venta de $${sale.amount.toLocaleString()} a ${sale.customerName}`, sale.id)

        // Save to Local DB
        try {
            await db.sales.add({
                id: saleId,
                branchId: sale.branchId,
                total: sale.amount,
                createdAt: new Date(),
                status: isOnline ? 'COMPLETED' : 'PENDING',
                userId: sale.userId,
                items: sale.lineItems || []
            });

            if (!isOnline) {
                await db.pendingActions.add({
                    id: crypto.randomUUID(),
                    type: 'CREATE_SALE',
                    payload: { ...sale, tempId: saleId },
                    createdAt: Date.now(),
                    synced: false,
                    failedCount: 0
                });
            } else {
                // Here we would call the API if online
                // await api.sales.create(sale)...
            }
        } catch (e) {
            console.error("Failed to save sale locally", e);
        }
    }

    const getExpensesByType = (type: BusinessType) => {
        return expenses.filter((e) => e.businessType === type)
    }

    const getSalesByType = (type: BusinessType) => {
        return sales.filter((s) => s.businessType === type)
    }

    const getTotalExpensesByType = (type: BusinessType) => {
        return expenses
            .filter((e) => e.businessType === type)
            .reduce((acc, curr) => acc + curr.amount, 0)
    }

    const getTotalSalesByType = (type: BusinessType) => {
        return sales
            .filter((s) => s.businessType === type)
            .reduce((acc, curr) => acc + curr.amount, 0)
    }

    return (
        <TransactionsContext.Provider value={{
            expenses,
            sales,
            addExpense,
            addSale,
            getExpensesByType,
            getSalesByType,
            getTotalExpensesByType,
            getTotalSalesByType
        }}>
            {children}
        </TransactionsContext.Provider>
    )
}

export function useTransactions() {
    const context = useContext(TransactionsContext)
    if (context === undefined) {
        throw new Error("useTransactions must be used within a TransactionsProvider")
    }
    return context
}
