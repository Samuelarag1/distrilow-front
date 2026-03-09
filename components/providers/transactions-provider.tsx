"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useBusiness } from "./business-provider";
import { useAudit } from "./audit-provider";
import { useUser } from "./user-provider";
import { backendApi } from "@/lib/backend-api";
import type {
  ExpenseCategory,
  ExpenseContext,
  PaymentMethod,
  Sale as ApiSale,
  SaleChargeStatus,
  SaleLifecycleStatus,
  SalePaymentInput,
} from "@/lib/api-types";
import type { BusinessType } from "@/lib/data-service";

export interface Expense {
  id: string;
  branchId: string;
  amount: number;
  category: string;
  description: string;
  context: ExpenseContext;
  date: string;
  businessType: BusinessType;
  userId?: string;
}

export interface SalePayment {
  id?: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  date: string;
}

export interface Sale {
  id: string;
  amount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  chargeStatus: SaleChargeStatus;
  lifecycleStatus: SaleLifecycleStatus;
  customerName: string;
  items: number;
  lineItems?: Array<{ productId: string; quantity: number; price: number }>;
  payments: SalePayment[];
  date: string;
  businessType: BusinessType;
  userId: string;
  userName: string;
  branchId: string;
  status?: "PENDING" | "COMPLETED";
}

export interface AddExpenseInput {
  branchId?: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  context?: ExpenseContext;
  businessType?: BusinessType;
}

export interface AddSaleInput {
  branchId?: string;
  customerName?: string;
  lineItems: Array<{ productId: string; quantity: number; price: number }>;
  payments?: Array<{
    amount: number;
    method: PaymentMethod;
    reference?: string;
    notes?: string;
  }>;
}

interface TransactionsContextType {
  expenses: Expense[];
  sales: Sale[];
  isLoading: boolean;
  addExpense: (expense: AddExpenseInput) => Promise<void>;
  addSale: (sale: AddSaleInput) => Promise<Sale>;
  registerSalePayment: (
    saleId: string,
    payment: {
      amount: number;
      method: PaymentMethod;
      reference?: string;
      notes?: string;
    }
  ) => Promise<Sale>;
  cancelSale: (saleId: string) => Promise<void>;
  refreshTransactions: () => Promise<void>;
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
const MAX_EXPENSE_AMOUNT = 9_999_999.99;
const MAX_EXPENSE_DESCRIPTION_LENGTH = 180;

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUnitPrice(value: unknown) {
  const rounded = Math.round(toFiniteNumber(value, NaN) * 1_000_000) / 1_000_000;
  if (!Number.isFinite(rounded) || rounded < 0) return null;
  return rounded;
}

function normalizeQuantity(value: unknown) {
  const rounded = Math.round(toFiniteNumber(value, NaN) * 1_000) / 1_000;
  if (!Number.isFinite(rounded) || rounded < 0) return null;
  return rounded;
}

function dedupeById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];

  rows.forEach((row) => {
    const id = String(row.id ?? "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    deduped.push(row);
  });

  return deduped;
}

function deriveContextFromBusinessType(type: BusinessType): ExpenseContext {
  return type === "wholesale" ? "WHOLESALE" : "RETAIL";
}

function deriveBusinessTypeFromContext(
  context: ExpenseContext | undefined,
  fallbackType: BusinessType
): BusinessType {
  if (context === "WHOLESALE") return "wholesale";
  if (context === "RETAIL") return "retail";
  return fallbackType;
}

function normalizeExpense(row: any, fallbackBusinessType: BusinessType): Expense {
  const context = String(row.context ?? "GENERAL").toUpperCase() as ExpenseContext;
  return {
    id: String(row.id),
    branchId: String(row.branchId ?? ""),
    amount: toFiniteNumber(row.amount, 0),
    category: String(row.category ?? "OTHER"),
    description: String(row.description ?? ""),
    context,
    date: String(row.createdAt ?? row.updatedAt ?? new Date().toISOString()),
    businessType: deriveBusinessTypeFromContext(context, fallbackBusinessType),
  };
}

function normalizeSale(row: ApiSale, businessType: BusinessType): Sale {
  const lineItems: Array<{ productId: string; quantity: number; price: number }> =
    Array.isArray(row.items)
      ? row.items.map((item) => ({
          productId: item.productId,
          quantity: toFiniteNumber(item.quantity, 0),
          price: toFiniteNumber(item.unitPrice, 0),
        }))
      : [];

  const computedTotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );
  const totalAmount = toFiniteNumber(row.totalAmount ?? row.total, computedTotal);
  const payments = Array.isArray(row.payments)
    ? row.payments.map((payment) => ({
        id: payment.id,
        amount: toFiniteNumber(payment.amount, 0),
        method: String(payment.method ?? "OTHER"),
        reference: payment.reference ?? undefined,
        notes: payment.notes ?? undefined,
        date: String(payment.createdAt ?? payment.updatedAt ?? row.createdAt ?? new Date().toISOString()),
      }))
    : [];
  const paidAmount = toFiniteNumber(
    row.paidAmount,
    payments.reduce((sum, payment) => sum + payment.amount, 0)
  );
  const outstandingAmount = Math.max(
    0,
    toFiniteNumber(row.outstandingAmount, totalAmount - paidAmount)
  );
  const chargeStatus =
    (row.chargeStatus as SaleChargeStatus | undefined) ??
    (outstandingAmount <= 0
      ? "PAID"
      : paidAmount > 0
      ? "PARTIALLY_PAID"
      : "PENDING");
  const lifecycleStatus =
    (row.lifecycleStatus as SaleLifecycleStatus | undefined) ??
    (String(row.status ?? "").toUpperCase() === "CANCELLED"
      ? "CANCELLED"
      : "ACTIVE");

  return {
    id: String(row.id),
    amount: totalAmount,
    totalAmount,
    paidAmount,
    outstandingAmount,
    chargeStatus,
    lifecycleStatus,
    customerName: row.clientId ? `Cliente ${row.clientId}` : "Consumidor Final",
    items: lineItems.reduce((sum, item) => sum + item.quantity, 0),
    lineItems,
    payments,
    date: String(row.createdAt ?? row.updatedAt ?? new Date().toISOString()),
    businessType,
    userId: String((row as any).userId ?? "unknown"),
    userName: String((row as any).user?.email ?? (row as any).userName ?? "Usuario"),
    branchId: String(row.branchId ?? ""),
    status: chargeStatus === "PENDING" ? "PENDING" : "COMPLETED",
  };
}

async function collectAllPages<T>(
  fetchPage: (skip: number, take: number) => Promise<{
    items: T[];
    meta: { hasMore: boolean; limit: number; offset?: number };
  }>,
  pageSize = 100,
  maxPages = 8
) {
  const result: T[] = [];
  const seenIds = new Set<string>();
  let skip = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const payload = await fetchPage(skip, pageSize);
    let appendedCount = 0;
    payload.items.forEach((item) => {
      const id = String((item as any)?.id ?? "").trim();
      if (id && seenIds.has(id)) return;
      if (id) seenIds.add(id);
      result.push(item);
      appendedCount += 1;
    });

    if (payload.meta.hasMore && appendedCount === 0) {
      break;
    }
    if (!payload.meta.hasMore) break;

    const safeLimit = Math.max(1, toFiniteNumber(payload.meta.limit, pageSize));
    skip += safeLimit;
  }

  return result;
}

export function TransactionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const refreshRequestIdRef = useRef(0);
  const { logEvent } = useAudit();
  const { token, branchId } = useUser();
  const { businessType } = useBusiness();

  const upsertSale = useCallback(
    (incoming: Sale) => {
      setSales((prev) => {
        const next = prev.filter((sale) => sale.id !== incoming.id);
        return [incoming, ...next].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      });
    },
    [setSales]
  );

  const upsertExpense = useCallback(
    (incoming: Expense) => {
      setExpenses((prev) => {
        const next = prev.filter((expense) => expense.id !== incoming.id);
        return [incoming, ...next].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      });
    },
    [setExpenses]
  );

  const refreshTransactions = useCallback(async () => {
    const requestId = ++refreshRequestIdRef.current;

    if (!token || !branchId) {
      if (requestId !== refreshRequestIdRef.current) return;
      setSales([]);
      setExpenses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [apiSales, apiExpenses] = await Promise.all([
        collectAllPages((skip, take) => backendApi.sales.list({ skip, take }, branchId)),
        collectAllPages((skip, take) => backendApi.expenses.list({ skip, take }, branchId)),
      ]);

      if (requestId !== refreshRequestIdRef.current) return;

      setSales(
        dedupeById(
          apiSales
            .map((sale) => normalizeSale(sale, businessType))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        )
      );
      setExpenses(
        dedupeById(
          apiExpenses
            .map((expense) => normalizeExpense(expense, businessType))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        )
      );
    } catch (e) {
      if (requestId !== refreshRequestIdRef.current) return;
      console.error("Error loading transactions data", e);
    } finally {
      if (requestId !== refreshRequestIdRef.current) return;
      setIsLoading(false);
    }
  }, [token, branchId, businessType]);

  useEffect(() => {
    void refreshTransactions();
  }, [refreshTransactions]);

  const addExpense = useCallback(
    async (newExpense: AddExpenseInput) => {
      const resolvedBranchId = newExpense.branchId || branchId;
      if (!resolvedBranchId) {
        throw new Error("No hay sucursal activa para registrar el gasto.");
      }

      const amount = toFiniteNumber(newExpense.amount, NaN);
      if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_EXPENSE_AMOUNT) {
        throw new Error(
          `El monto debe ser mayor a 0 y menor o igual a ${MAX_EXPENSE_AMOUNT}.`
        );
      }

      const normalizedDescription = String(newExpense.description ?? "").trim();
      if (!normalizedDescription) {
        throw new Error("La descripcion del gasto es obligatoria.");
      }
      if (normalizedDescription.length > MAX_EXPENSE_DESCRIPTION_LENGTH) {
        throw new Error(
          `La descripcion no puede superar ${MAX_EXPENSE_DESCRIPTION_LENGTH} caracteres.`
        );
      }

      const resolvedContext =
        newExpense.context ??
        (newExpense.businessType
          ? deriveContextFromBusinessType(newExpense.businessType)
          : deriveContextFromBusinessType(businessType));

      const savedExpense = await backendApi.expenses.create({
        branchId: resolvedBranchId,
        amount,
        category: newExpense.category as ExpenseCategory,
        description: normalizedDescription,
        context: resolvedContext,
      });

      const normalized = normalizeExpense(savedExpense, businessType);
      upsertExpense(normalized);

      logEvent(
        "create",
        "expense",
        `Registro un gasto de $${normalized.amount.toLocaleString()}: ${normalized.description}`,
        normalized.id
      );
    },
    [branchId, businessType, logEvent, upsertExpense]
  );

  const addSale = useCallback(
    async (newSale: AddSaleInput) => {
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

      const payments = (newSale.payments ?? [])
        .map((payment) => ({
          amount: toFiniteNumber(payment.amount, 0),
          method: payment.method,
          reference: payment.reference?.trim() || undefined,
          notes: payment.notes?.trim() || undefined,
        }))
        .filter((payment) => payment.amount > 0) as SalePaymentInput[];

      const savedSale = await backendApi.sales.create({
        branchId: resolvedBranchId,
        items: saleItems,
        payments: payments.length > 0 ? payments : undefined,
      });

      const normalized = normalizeSale(savedSale, businessType);
      upsertSale(normalized);

      logEvent(
        "create",
        "sale",
        `Registro una venta de $${normalized.amount.toLocaleString()} (${normalized.items} items)`,
        normalized.id
      );

      return normalized;
    },
    [branchId, businessType, logEvent, upsertSale]
  );

  const registerSalePayment = useCallback(
    async (
      saleId: string,
      payment: {
        amount: number;
        method: PaymentMethod;
        reference?: string;
        notes?: string;
      }
    ) => {
      const amount = toFiniteNumber(payment.amount, 0);
      if (amount <= 0) {
        throw new Error("El monto del pago debe ser mayor a 0.");
      }

      await backendApi.sales.addPayment(saleId, {
        amount,
        method: payment.method,
        reference: payment.reference?.trim() || undefined,
        notes: payment.notes?.trim() || undefined,
      });
      const updatedSale = await backendApi.sales.getById(saleId);
      const normalized = normalizeSale(updatedSale, businessType);
      upsertSale(normalized);
      return normalized;
    },
    [businessType, upsertSale]
  );

  const cancelSale = useCallback(
    async (saleId: string) => {
      await backendApi.sales.cancel(saleId);
      try {
        const updatedSale = await backendApi.sales.getById(saleId);
        upsertSale(normalizeSale(updatedSale, businessType));
      } catch {
        setSales((prev) =>
          prev.map((sale) =>
            sale.id === saleId
              ? { ...sale, lifecycleStatus: "CANCELLED" as const }
              : sale
          )
        );
      }
    },
    [businessType, upsertSale]
  );

  const getExpensesByType = useCallback(
    (type: BusinessType) => expenses.filter((e) => e.businessType === type),
    [expenses]
  );

  const getSalesByType = useCallback(
    (type: BusinessType) => sales.filter((s) => s.businessType === type),
    [sales]
  );

  const getTotalExpensesByType = useCallback(
    (type: BusinessType) =>
      expenses
        .filter((e) => e.businessType === type)
        .reduce((acc, curr) => acc + curr.amount, 0),
    [expenses]
  );

  const getTotalSalesByType = useCallback(
    (type: BusinessType) =>
      sales
        .filter((s) => s.businessType === type)
        .reduce((acc, curr) => acc + curr.amount, 0),
    [sales]
  );

  return (
    <TransactionsContext.Provider
      value={{
        expenses,
        sales,
        isLoading,
        addExpense,
        addSale,
        registerSalePayment,
        cancelSale,
        refreshTransactions,
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
    throw new Error("useTransactions must be used within a TransactionsProvider");
  }
  return context;
}
