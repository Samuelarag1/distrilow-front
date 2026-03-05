"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useBusiness } from "./business-provider";
import { useAudit } from "./audit-provider";
import { useUser } from "./user-provider";
import { backendApi } from "@/lib/backend-api";
import type { ExpenseCategory } from "@/lib/api-types";
import type { BusinessType } from "@/lib/data-service";

export interface Expense {
  id: string;
  branchId: string;
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
  items: number;
  lineItems?: Array<{ productId: string; quantity: number; price: number }>;
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
  addExpense: (
    expense: Omit<Expense, "id" | "date" | "branchId"> & { branchId?: string }
  ) => Promise<void>;
  addSale: (
    sale: Omit<Sale, "id" | "date" | "branchId"> & { branchId?: string }
  ) => Promise<void>;
  getExpensesByType: (type: BusinessType) => Expense[];
  getSalesByType: (type: BusinessType) => Sale[];
  getTotalExpensesByType: (type: BusinessType) => number;
  getTotalSalesByType: (type: BusinessType) => number;
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(
  undefined
);

const MAX_NUMERIC_10_2 = 99_999_999.99;
const MAX_QUANTITY = 99_999_999;
const MAX_UNIT_PRICE = 9_999_999.999999;

function toFiniteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUnitPrice(value: unknown) {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  const rounded = Math.round(parsed * 1_000_000) / 1_000_000;
  if (rounded < 0) return null;
  return rounded;
}

function normalizeQuantity(value: unknown) {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  const rounded = Math.round(parsed * 1_000) / 1_000;
  if (rounded < 0) return null;
  return rounded;
}

function normalizeExpense(row: any, businessType: BusinessType): Expense {
  return {
    id: row.id,
    branchId: row.branchId,
    amount: Number(row.amount ?? 0),
    category: String(row.category ?? "OTHER"),
    description: String(row.description ?? ""),
    date: String(row.createdAt ?? row.updatedAt ?? new Date().toISOString()),
    businessType,
  };
}

function normalizeSale(row: any, businessType: BusinessType): Sale {
  const lineItems: Array<{ productId: string; quantity: number; price: number }> =
    Array.isArray(row.items)
    ? row.items.map((item: any) => ({
        productId: item.productId,
        quantity: Number(item.quantity ?? 0),
        price: Number(item.unitPrice ?? 0),
      }))
    : [];

  const computedAmount = lineItems.reduce(
    (sum: number, item) => sum + item.quantity * item.price,
    0
  );

  return {
    id: row.id,
    amount: Number(row.total ?? computedAmount),
    customerName: row.clientId ? `Cliente ${row.clientId}` : "Consumidor Final",
    items: lineItems.reduce((sum: number, item) => sum + item.quantity, 0),
    lineItems,
    date: String(row.createdAt ?? new Date().toISOString()),
    businessType,
    userId: String(row.userId ?? "unknown"),
    userName: String(row.user?.email ?? row.userName ?? "Usuario"),
    branchId: String(row.branchId ?? ""),
    status: row.status === "PENDING" ? "PENDING" : "COMPLETED",
  };
}

export function TransactionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { logEvent } = useAudit();
  const { token, branchId } = useUser();
  const { businessType } = useBusiness();

  useEffect(() => {
    const loadData = async () => {
      if (!token || !branchId) {
        setSales([]);
        setExpenses([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setSales([]);
      setExpenses([]);
      try {
        const [apiSales, apiExpenses] = await Promise.all([
          backendApi.sales.list(),
          backendApi.expenses.list(),
        ]);

        setSales(
          apiSales
            .map((sale) => normalizeSale(sale, businessType))
            .sort(
              (a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        );
        setExpenses(
          apiExpenses
            .map((expense) => normalizeExpense(expense, businessType))
            .sort(
              (a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        );
      } catch (e) {
        console.error("Error loading transactions data", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [token, branchId, businessType]);

  const addExpense = async (
    newExpense: Omit<Expense, "id" | "date" | "branchId"> & { branchId?: string }
  ) => {
    const resolvedBranchId = newExpense.branchId || branchId;
    if (!resolvedBranchId) {
      throw new Error("No hay sucursal activa para registrar el gasto.");
    }

    const savedExpense = await backendApi.expenses.create({
      branchId: resolvedBranchId,
      amount: Number(newExpense.amount),
      category: newExpense.category as ExpenseCategory,
      description: newExpense.description,
    });

    const normalized = normalizeExpense(savedExpense, businessType);

    setExpenses((prev) => [normalized, ...prev]);

    logEvent(
      "create",
      "expense",
      `Registro un gasto de $${normalized.amount.toLocaleString()}: ${normalized.description}`,
      normalized.id
    );
  };

  const addSale = async (
    newSale: Omit<Sale, "id" | "date" | "branchId"> & { branchId?: string }
  ) => {
    const resolvedBranchId = newSale.branchId || branchId;
    if (!resolvedBranchId) {
      throw new Error("No hay sucursal activa para registrar la venta.");
    }

    const saleItems = (newSale.lineItems ?? []).map((item, index) => {
      const quantity = normalizeQuantity(item.quantity);
      const unitPrice = normalizeUnitPrice(item.price);

      if (quantity === null || quantity <= 0 || quantity > MAX_QUANTITY) {
        throw new Error(
          `Cantidad invalida en item ${index + 1}. Debe ser mayor a 0 y menor o igual a ${MAX_QUANTITY}.`
        );
      }

      if (unitPrice === null || unitPrice <= 0 || unitPrice > MAX_UNIT_PRICE) {
        throw new Error(
          `Precio invalido en item ${index + 1}. Debe ser mayor a 0 y menor o igual a ${MAX_UNIT_PRICE}.`
        );
      }

      const lineTotal = quantity * unitPrice;
      if (lineTotal > MAX_NUMERIC_10_2) {
        throw new Error(
          `El subtotal del item ${index + 1} excede el limite permitido (${MAX_NUMERIC_10_2}).`
        );
      }

      return {
        productId: item.productId,
        quantity,
        unitPrice,
      };
    });

    if (saleItems.length === 0) {
      throw new Error("La venta debe incluir al menos un item.");
    }

    const savedSale = await backendApi.sales.create({
      branchId: resolvedBranchId,
      items: saleItems,
    });

    const normalized = normalizeSale(savedSale, businessType);

    setSales((prev) => [normalized, ...prev]);

    logEvent(
      "create",
      "sale",
      `Registro una venta de $${normalized.amount.toLocaleString()} (${normalized.items} items)`,
      normalized.id
    );
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
