"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { BusinessType } from "@/lib/data-service"
import { useBusiness } from "./business-provider"
import { useAudit } from "./audit-provider"
import { useUser } from "./user-provider"

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
    items: number
    date: string
    businessType: BusinessType
    userId: string
    userName: string
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

    // Initialize with some dummy data for demonstration
    useEffect(() => {
        setExpenses([
            {
                id: "1",
                amount: 50000,
                category: "Servicios",
                description: "Pago de Luz",
                date: new Date().toISOString(),
                businessType: "retail",
                userId: "1"
            },
            {
                id: "2",
                amount: 120000,
                category: "Mantenimiento",
                description: "Reparación AA",
                date: new Date().toISOString(),
                businessType: "retail",
                userId: "1"
            },
            {
                id: "3",
                amount: 350000,
                category: "Logística",
                description: "Flete Distribución",
                date: new Date().toISOString(),
                businessType: "wholesale",
                userId: "1"
            }
        ])

        setSales([
            {
                id: "s1",
                amount: 45000,
                customerName: "Ana Lopez",
                items: 3,
                date: new Date().toISOString(),
                businessType: "retail",
                userId: "2",
                userName: "Maria"
            },
            {
                id: "s2",
                amount: 890000,
                customerName: "Distribuidora Sur",
                items: 45,
                date: new Date().toISOString(),
                businessType: "wholesale",
                userId: "1",
                userName: "Samuel"
            }
        ])
    }, [])

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

    const addSale = (newSale: Omit<Sale, "id" | "date">) => {
        const sale: Sale = {
            ...newSale,
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString()
        }
        logEvent("create", "sale", `Realizó una venta de $${sale.amount.toLocaleString()} a ${sale.customerName}`, sale.id)
        setSales((prev) => [sale, ...prev])
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
