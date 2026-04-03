import type {
  PaymentMethod,
  SalePaymentBreakdownByMethod as ApiSalePaymentBreakdownByMethod,
  SalePaymentType,
} from "@/lib/api-types";

export type SalePaymentBreakdownByMethod = {
  cash: number;
  transfer: number;
  card: number;
  other: number;
};

const PAYMENT_AMOUNT_THRESHOLD = 0.0001;
const WHOLE_AMOUNT_FORMATTER = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

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
  if (normalized === "DEBITO") return "DEBIT_CARD";
  if (normalized === "CREDITO") return "CREDIT_CARD";
  if (normalized === "TARJETA") return "CARD";
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
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as ApiSalePaymentBreakdownByMethod)
      : null;
  const breakdown = normalizeSalePaymentBreakdown(value);
  const cardBreakdownTotal = [
    breakdown.CARD,
    breakdown.DEBIT_CARD,
    breakdown.CREDIT_CARD,
    breakdown.DEBITO,
    breakdown.CREDITO,
  ].reduce((sum, amount) => sum + toFiniteNumber(amount, 0), 0);
  const otherKnownTotals = [
    breakdown.OTHER,
    breakdown.MERCADO_PAGO,
    breakdown.MP,
  ].reduce((sum, amount) => sum + toFiniteNumber(amount, 0), 0);

  return {
    cash: toFiniteNumber(source?.cash, breakdown.CASH ?? breakdown.cash ?? 0),
    transfer: toFiniteNumber(
      source?.transfer,
      breakdown.TRANSFER ??
        breakdown.transfer ??
        breakdown.TRANSFERENCIA ??
        breakdown.transferencia ??
        0
    ),
    card: toFiniteNumber(source?.card, cardBreakdownTotal),
    other: toFiniteNumber(source?.other, otherKnownTotals),
  };
}

export function classifySalePaymentType(
  breakdownByMethod: SalePaymentBreakdownByMethod
): SalePaymentType {
  const hasCash =
    toFiniteNumber(breakdownByMethod.cash, 0) > PAYMENT_AMOUNT_THRESHOLD;
  const hasTransfer =
    toFiniteNumber(breakdownByMethod.transfer, 0) > PAYMENT_AMOUNT_THRESHOLD;
  const hasCard =
    toFiniteNumber(breakdownByMethod.card, 0) > PAYMENT_AMOUNT_THRESHOLD;
  const hasOther =
    toFiniteNumber(breakdownByMethod.other, 0) > PAYMENT_AMOUNT_THRESHOLD;
  const activeMethodCount = [hasCash, hasTransfer, hasCard, hasOther].filter(
    Boolean
  ).length;

  if (activeMethodCount > 1) return "MIXED";
  if (hasCash) return "CASH";
  if (hasTransfer) return "TRANSFER";
  return "OTHER";
}

export function getSalePaymentTypeLabel(type: SalePaymentType) {
  if (type === "MIXED") return "Mixto";
  if (type === "CASH") return "Efectivo";
  if (type === "TRANSFER") return "Transferencia";
  return "Otro";
}

export function getSalePaymentTypeBadgeClassName(type: SalePaymentType) {
  if (type === "MIXED") return "bg-orange-100 text-orange-800";
  if (type === "CASH") return "bg-emerald-100 text-emerald-800";
  if (type === "TRANSFER") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-700";
}

export function normalizeWholeAmountInput(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  return digits.replace(/^0+(?=\d)/, "");
}

export function formatWholeAmountInput(value: unknown) {
  const normalized =
    typeof value === "string"
      ? normalizeWholeAmountInput(value)
      : typeof value === "number" && Number.isFinite(value) && value > 0
      ? String(Math.trunc(value))
      : "";

  if (!normalized) return "";
  return WHOLE_AMOUNT_FORMATTER.format(Number(normalized));
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
