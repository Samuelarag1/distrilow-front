"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { BusinessType } from "@/lib/data-service";
import { useAudit } from "./audit-provider";
import { useUser } from "./user-provider";
import { db } from "@/lib/db";
import { useNetworkStatus } from "@/hooks/use-network";
import { apiClientFetch } from "@/lib/api-client";
export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  businessType: BusinessType;
  userId?: string;
}

export interface Sale {
  id: string;
  amount: number;
  customerName: string;
  items: number; // count
  lineItems?: any[]; // details
  date: string;
  businessType: BusinessType;
  userId: string;
  userName: string;
  branchId: string;
  status?: "PENDING" | "COMPLETED";
}

interface TransactionsContextType {
  expenses: Expense[];
  sales: Sale[];
  isLoading: boolean;
  addExpense: (expense: Omit<Expense, "id" | "date">) => Promise<void>;
  addSale: (sale: Omit<Sale, "id" | "date">) => Promise<void>;
  getExpensesByType: (type: BusinessType) => Expense[];
  getSalesByType: (type: BusinessType) => Sale[];
  getTotalExpensesByType: (type: BusinessType) => number;
  getTotalSalesByType: (type: BusinessType) => number;
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(
  undefined
);

export function TransactionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { logEvent } = useAudit();
  const { currentUser, token } = useUser();
  const isOnline = useNetworkStatus();

  // Load from API + Local DB
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 1. Try to fetch from API if online
        if (isOnline && token) {
          try {
            const apiSales = await apiClientFetch.get("/sales");
            // Sync local DB with API data if needed?
            // For now just set state
            setSales(apiSales);
          } catch (e) {
            console.error(
              "Failed to fetch sales from API, falling back to local",
              e
            );
          }
        }

        // 2. Load from Local DB (always show what we have)
        const dbSales = await db.sales.toArray();
        const mappedSales = dbSales.map(
          (s) =>
            ({
              id: s.id,
              amount: s.total,
              customerName: "Cliente Local", // This might be in s.clientId if we joined
              items: s.items ? s.items.length : 0,
              lineItems: s.items,
              date: s.createdAt.toISOString(),
              businessType: "retail" as BusinessType,
              userId: s.userId || "unknown",
              userName: "User",
              status: s.status === "PENDING" ? "PENDING" : "COMPLETED",
              branchId: s.branchId,
            } as Sale)
        );

        // Merge (simple replacement or merging based on ID)
        setSales((prev) => {
          const merged = [...prev];
          mappedSales.forEach((ls) => {
            if (!merged.find((ms) => ms.id === ls.id)) {
              merged.push(ls);
            }
          });
          return merged.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        });

        // Similar for expenses...
        if (isOnline && token) {
          try {
            const apiExpenses = await apiClientFetch.get("/expenses");
            setExpenses(apiExpenses);
          } catch (e) {
            console.error("Failed to fetch expenses from API", e);
          }
        }
      } catch (e) {
        console.error("Critical error loading transactions data", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOnline, token]);

  const addExpense = async (newExpense: Omit<Expense, "id" | "date">) => {
    const tempId = crypto.randomUUID();
    const expense: Expense = {
      ...newExpense,
      id: tempId,
      date: new Date().toISOString(),
      userId: currentUser?.id,
    };

    try {
      if (isOnline) {
        const savedExpense = await apiClientFetch.post("/expenses", expense);
        setExpenses((prev) => [savedExpense, ...prev]);
      } else {
        // Offline handling
        setExpenses((prev) => [expense, ...prev]);
        await db.pendingActions.add({
          id: crypto.randomUUID(),
          type: "CREATE_EXPENSE" as any, // Need to add this type
          payload: expense,
          createdAt: Date.now(),
          synced: false,
          failedCount: 0,
        });
      }
      logEvent(
        "create",
        "expense",
        `Registró un gasto de $${expense.amount.toLocaleString()}: ${
          expense.description
        }`,
        tempId
      );
    } catch (error) {
      console.error("Failed to add expense", error);
    }
  };

  const addSale = async (newSale: Omit<Sale, "id" | "date">) => {
    const saleId = crypto.randomUUID();
    const sale: Sale = {
      ...newSale,
      id: saleId,
      date: new Date().toISOString(),
      status: isOnline ? "COMPLETED" : "PENDING",
    };

    // Update UI immediately (Optimistic UI)
    setSales((prev) => [sale, ...prev]);
    logEvent(
      "create",
      "sale",
      `Realizó una venta de $${sale.amount.toLocaleString()} a ${
        sale.customerName
      }`,
      sale.id
    );

    // Save to Local DB always for offline-first
    try {
      await db.sales.add({
        id: saleId,
        branchId: sale.branchId,
        total: sale.amount,
        createdAt: new Date(),
        status: isOnline ? "COMPLETED" : "PENDING",
        userId: sale.userId,
        items: sale.lineItems || [],
      });

      if (isOnline) {
        try {
          await apiClientFetch.post("/sales", { ...sale, id: saleId });
          // If online sync worked, we could update local status,
          // but Dexie add already set it to COMPLETED if isOnline was true
        } catch (apiError) {
          console.error("Online sale sync failed, queuing for later", apiError);
          await db.pendingActions.add({
            id: crypto.randomUUID(),
            type: "CREATE_SALE",
            payload: { ...sale, tempId: saleId },
            createdAt: Date.now(),
            synced: false,
            failedCount: 0,
          });
          // Revert status to PENDING locally if needed
          await db.sales.update(saleId, { status: "PENDING" });
          setSales((prev) =>
            prev.map((s) => (s.id === saleId ? { ...s, status: "PENDING" } : s))
          );
        }
      } else {
        await db.pendingActions.add({
          id: crypto.randomUUID(),
          type: "CREATE_SALE",
          payload: { ...sale, tempId: saleId },
          createdAt: Date.now(),
          synced: false,
          failedCount: 0,
        });
      }
    } catch (e) {
      console.error("Failed to save sale", e);
    }
  };

  const getExpensesByType = (type: BusinessType) => {
    return expenses.filter((e) => e.businessType === type);
  };

  const getSalesByType = (type: BusinessType) => {
    return sales.filter((s) => s.businessType === type);
  };

  const getTotalExpensesByType = (type: BusinessType) => {
    return expenses
      .filter((e) => e.businessType === type)
      .reduce((acc, curr) => acc + curr.amount, 0);
  };

  const getTotalSalesByType = (type: BusinessType) => {
    return sales
      .filter((s) => s.businessType === type)
      .reduce((acc, curr) => acc + curr.amount, 0);
  };

  return (
    <TransactionsContext.Provider
      value={{
        expenses,
        sales,
        isLoading,
        addExpense,
        addSale,
        getExpensesByType,
        getSalesByType,
        getTotalExpensesByType,
        getTotalSalesByType,
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionsContext);
  if (context === undefined) {
    throw new Error(
      "useTransactions must be used within a TransactionsProvider"
    );
  }
  return context;
}
