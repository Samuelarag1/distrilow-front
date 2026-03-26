import type { PaymentMethod } from "@/lib/api-types";

export type SalePaymentType =
  | "MIXTO"
  | "SOLO_EFECTIVO"
  | "SOLO_TRANSFERENCIA"
  | "SIN_PAGO";

export type SalePaymentBreakdownByMethod = {
  cash: number;
  transfer: number;
};

const PAYMENT_AMOUNT_THRESHOLD = 0.0001;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeSalePaymentMethodKey(method: unknown) {
  const normalized = String(method ?? "")
    .trim()
    .toUpperCase();

  if (normalized === "EFECTIVO") return "CASH";
  if (normalized === "TRANSFERENCIA") return "TRANSFER";
  return normalized;
}

export function getPaymentMethodLabel(method: string | PaymentMethod) {
  const normalized = normalizeSalePaymentMethodKey(method);
  if (normalized === "CASH") return "Efectivo";
  if (normalized === "TRANSFER") return "Transferencia";
  if (normalized === "DEBIT_CARD") return "Debito";
  if (normalized === "CREDIT_CARD") return "Credito";
  if (normalized === "MERCADO_PAGO") return "Mercado Pago";
  if (normalized === "OTHER") return "Otro";
  return normalized || "Sin pago";
}

export function normalizeSalePaymentBreakdown(
  value: unknown
): Record<string, number> {
  if (!isRecord(value)) return {};

  const nestedByMethod =
    (isRecord(value.paidByMethod) && value.paidByMethod) ||
    (isRecord(value.byMethod) && value.byMethod) ||
    (isRecord(value.appliedByMethod) && value.appliedByMethod) ||
    null;
  const source = nestedByMethod ?? value;
  const normalized: Record<string, number> = {};

  Object.entries(source).forEach(([rawMethod, rawAmount]) => {
    const method = normalizeSalePaymentMethodKey(rawMethod);
    if (!method) return;

    const amount = toFiniteNumber(rawAmount, Number.NaN);
    if (!Number.isFinite(amount)) return;

    normalized[method] = toFiniteNumber(normalized[method], 0) + amount;
  });

  return normalized;
}

export function getSalePaymentBreakdownByMethod(
  value: unknown
): SalePaymentBreakdownByMethod {
  const breakdown = normalizeSalePaymentBreakdown(value);

  return {
    cash: toFiniteNumber(breakdown.CASH ?? breakdown.cash, 0),
    transfer: toFiniteNumber(
      breakdown.TRANSFER ??
        breakdown.transfer ??
        breakdown.TRANSFERENCIA ??
        breakdown.transferencia,
      0
    ),
  };
}

export function classifySalePaymentType(
  breakdownByMethod: SalePaymentBreakdownByMethod
): SalePaymentType {
  const hasCash =
    toFiniteNumber(breakdownByMethod.cash, 0) > PAYMENT_AMOUNT_THRESHOLD;
  const hasTransfer =
    toFiniteNumber(breakdownByMethod.transfer, 0) > PAYMENT_AMOUNT_THRESHOLD;

  if (hasCash && hasTransfer) return "MIXTO";
  if (hasCash) return "SOLO_EFECTIVO";
  if (hasTransfer) return "SOLO_TRANSFERENCIA";
  return "SIN_PAGO";
}

export function getSalePaymentTypeLabel(type: SalePaymentType) {
  if (type === "MIXTO") return "Mixto";
  if (type === "SOLO_EFECTIVO") return "Efectivo";
  if (type === "SOLO_TRANSFERENCIA") return "Transferencia";
  return "Sin pago";
}

export function getSalePaymentTypeBadgeClassName(type: SalePaymentType) {
  if (type === "MIXTO") return "text-sky-800 bg-orange-100 text-orange-800";
  if (type === "SOLO_EFECTIVO") return "bg-emerald-100 text-emerald-800";
  if (type === "SOLO_TRANSFERENCIA") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-700";
}

export function normalizeWholeAmountInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return "";

  return String(Math.trunc(parsed));
}

export function parseWholeAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
  }

  if (typeof value !== "string") return 0;

  const normalized = normalizeWholeAmountInput(value);
  if (!normalized) return 0;

  return Math.max(0, Math.trunc(Number(normalized)));
}
