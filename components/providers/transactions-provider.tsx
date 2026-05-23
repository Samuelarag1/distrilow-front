"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR from "swr";
import { useBusiness } from "./business-provider";
import { useAudit } from "./audit-provider";
import { useUser } from "./user-provider";
import { backendApi } from "@/lib/backend-api";
import type {
  ExpenseCategory,
  ExpenseContext,
  PaymentMethod,
  PriceType,
  PricingMode,
  SalePaymentInput,
} from "@/lib/api-types";
import type { BusinessType } from "@/lib/data-service";
import {
  ensureSaleDetail,
  normalizeSale,
  type SaleDetailViewModel,
  type SaleLineItemViewModel,
  type SalePaymentViewModel,
  type SaleViewModel,
} from "@/lib/adapters/sales";
import {
  parseWholeAmount,
} from "@/lib/sales-payments";

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

export type SalePayment = SalePaymentViewModel;
export type SaleLineItem = SaleLineItemViewModel;
export type Sale = SaleViewModel;
export type SaleDetail = SaleDetailViewModel;

export interface AddExpenseInput {
  branchId?: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
}

export interface AddSaleInput {
  branchId?: string;
  customerName?: string;
  lineItems: Array<{
    productId: string;
    quantity: number;
    pricingMode?: PricingMode;
    requestedPriceType?: PriceType;
    manualOverrideReason?: string;
  }>;
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
  getSaleDetail: (saleId: string) => Promise<Sale>;
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

const MAX_QUANTITY = 99_999_999;
const MAX_EXPENSE_AMOUNT = 9_999_999.99;
const MAX_EXPENSE_DESCRIPTION_LENGTH = 180;

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function deriveBusinessTypeFromContext(
  context: ExpenseContext | undefined,
  fallbackType: BusinessType
): BusinessType {
  if (context === "WHOLESALE") return "wholesale";
  if (context === "RETAIL") return "retail";
  return fallbackType;
}

function normalizeExpense(
  row: any,
  fallbackBusinessType: BusinessType
): Expense {
  const context = String(
    row.context ?? "GENERAL"
  ).toUpperCase() as ExpenseContext;
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

async function collectAllPages<T>(
  fetchPage: (
    skip: number,
    take: number
  ) => Promise<{
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
  autoLoadSales = false,
}: {
  children: React.ReactNode;
  autoLoadSales?: boolean;
}) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(autoLoadSales);
  const refreshRequestIdRef = useRef(0);
  const { logEvent } = useAudit();
  const { token, branchId } = useUser();
  const { businessType } = useBusiness();
  const salesListFilters = useMemo(
    () => ({
      branchId,
      limit: 100,
    }),
    [branchId]
  );
  const { data: salesSummaryData, mutate: mutateSalesSummary } = useSWR<Sale[]>(
    autoLoadSales && token && branchId
      ? (["/sales", salesListFilters] as const)
      : null,
    async () => {
      const apiSales = await collectAllPages((skip, take) =>
        backendApi.sales.list({ offset: skip, limit: take }, branchId)
      );
        return dedupeById(
          apiSales
          .map((sale) => normalizeSale(sale, { businessType }))
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
      );
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateOnMount: false,
      keepPreviousData: true,
      dedupingInterval: 60_000,
    }
  );

  const upsertSale = useCallback(
    (incoming: Sale) => {
      setSales((prev) => {
        const next = prev.filter((sale) => sale.id !== incoming.id);
        const updated = [incoming, ...next].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        void mutateSalesSummary(updated, false);
        return updated;
      });
    },
    [setSales, mutateSalesSummary]
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

    if (!autoLoadSales || !token || !branchId) {
      if (requestId !== refreshRequestIdRef.current) return;
      setSales([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      await mutateSalesSummary();
      if (requestId !== refreshRequestIdRef.current) return;
    } catch (e) {
      if (requestId !== refreshRequestIdRef.current) return;
    } finally {
      if (requestId !== refreshRequestIdRef.current) return;
      setIsLoading(false);
    }
  }, [autoLoadSales, token, branchId, mutateSalesSummary]);

  useEffect(() => {
    if (!autoLoadSales || !token || !branchId) {
      setSales([]);
      return;
    }
    if (!salesSummaryData) return;
    setSales(salesSummaryData);
  }, [autoLoadSales, token, branchId, salesSummaryData]);

  useEffect(() => {
    if (!autoLoadSales) {
      setIsLoading(false);
      setSales([]);
      return;
    }
    void refreshTransactions();
  }, [autoLoadSales, refreshTransactions]);

  const addExpense = useCallback(
    async (newExpense: AddExpenseInput) => {
      const resolvedBranchId = newExpense.branchId || branchId;
      if (!resolvedBranchId) {
        throw new Error("No hay sucursal activa para registrar el gasto.");
      }

      const amount = toFiniteNumber(newExpense.amount, NaN);
      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > MAX_EXPENSE_AMOUNT
      ) {
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

      const savedExpense = await backendApi.expenses.create({
        branchId: resolvedBranchId,
        amount,
        category: newExpense.category as ExpenseCategory,
        description: normalizedDescription,
      });

      const normalized = normalizeExpense(savedExpense, businessType);
      upsertExpense(normalized);

      logEvent(
        "create",
        "expense",
        `Registro un gasto de $${normalized.amount.toLocaleString()}: ${
          normalized.description
        }`,
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
        const pricingMode: PricingMode =
          item.pricingMode === "MANUAL" ? "MANUAL" : "AUTO";
        const requestedPriceType: PriceType | undefined =
          item.requestedPriceType === "WHOLESALE"
            ? "WHOLESALE"
            : item.requestedPriceType === "RETAIL"
            ? "RETAIL"
            : undefined;
        const manualOverrideReason =
          item.manualOverrideReason?.trim() || undefined;

        if (quantity === null || quantity <= 0 || quantity > MAX_QUANTITY) {
          throw new Error(
            `Cantidad invalida en item ${
              index + 1
            }. Debe ser mayor a 0 y menor o igual a ${MAX_QUANTITY}.`
          );
        }

        if (pricingMode === "MANUAL" && !requestedPriceType) {
          throw new Error(
            `Debes seleccionar tipo de precio manual en item ${index + 1}.`
          );
        }

        return {
          productId: item.productId,
          quantity,
          pricingMode,
          requestedPriceType,
          manualOverrideReason,
        };
      });

      if (saleItems.length === 0) {
        throw new Error("La venta debe incluir al menos un item.");
      }

      const payments = (newSale.payments ?? [])
        .map((payment) => ({
          amount: parseWholeAmount(payment.amount),
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

      const normalized = normalizeSale(savedSale, { businessType });
      upsertSale(normalized);

      logEvent(
        "create",
        "sale",
        `Registro una venta de $${normalized.amount.toLocaleString()} (${
          normalized.items
        } items)`,
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
      const amount = parseWholeAmount(payment.amount);
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
      const normalized = ensureSaleDetail(
        normalizeSale(updatedSale, { businessType })
      );
      upsertSale(normalized);
      return normalized;
    },
    [businessType, upsertSale]
  );

  const getSaleDetail = useCallback(
    async (saleId: string) => {
      const sale = await backendApi.sales.getById(saleId);
      const normalized = ensureSaleDetail(
        normalizeSale(sale, { businessType })
      );
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
        upsertSale(
          ensureSaleDetail(normalizeSale(updatedSale, { businessType }))
        );
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
        getSaleDetail,
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
    throw new Error(
      "useTransactions must be used within a TransactionsProvider"
    );
  }
  return context;
}
