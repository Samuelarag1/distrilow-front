import type {
  PricingMode,
  PriceType,
  SaleChargeStatus,
  SaleDetail,
  SaleLifecycleStatus,
  SalePayment as ApiSalePayment,
  SalePaymentInput,
  SalePaymentType,
  SaleSummary,
} from "../api-types";
import type { BusinessType } from "../data-service";
import { parseSaleNotesPayload } from "../sale-notes";
import {
  classifySalePaymentType,
  getSalePaymentBreakdownByMethod,
  normalizeSalePaymentBreakdown,
  normalizeSalePaymentMethodKey,
  type SalePaymentBreakdownByMethod,
} from "../sales-payments";
import {
  normalizeIsoDate,
  toFiniteNumber,
  toOptionalFiniteNumber,
  toOptionalText,
} from "./utils";

export interface SalePaymentViewModel {
  id?: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  receivedAmount?: number;
  changeAmount?: number;
  cancelledAt?: string | null;
  date: string;
}

export interface SaleLineItemViewModel {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  linkedProductId?: string;
  pricingMode?: PricingMode;
  requestedPriceType?: PriceType;
  priceType?: PriceType;
  pricingSource?: PricingMode;
  baseRetailPrice?: number;
  baseWholesalePrice?: number;
  pricingRuleSnapshot?: unknown;
  manualOverrideReason?: string | null;
}

export interface SaleViewModel {
  id: string;
  amount: number;
  totalAmount: number;
  totalCost: number;
  profit: number;
  paidAmount: number;
  outstandingAmount: number;
  chargeStatus: SaleChargeStatus;
  legacyChargeStatus?: SaleChargeStatus;
  lifecycleStatus: SaleLifecycleStatus;
  customerName: string;
  items: number;
  itemsCount: number;
  itemsQuantity: number;
  paymentBreakdown: Record<string, number>;
  paymentBreakdownByMethod: SalePaymentBreakdownByMethod;
  paymentType: SalePaymentType;
  paymentMethods: string[];
  lineItems?: SaleLineItemViewModel[];
  payments?: SalePaymentViewModel[];
  pendingReason?: string;
  pendingReasonLabel?: string;
  note?: string;
  notes?: string;
  notesRaw?: string;
  originalNotes?: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
  businessType: BusinessType;
  userId: string;
  userName: string;
  branchId: string;
  status?: "PENDING" | "COMPLETED";
}

export interface SaleDetailViewModel extends SaleViewModel {
  lineItems: SaleLineItemViewModel[];
  payments: SalePaymentViewModel[];
}

const KNOWN_PENDING_REASON_LABELS: Record<string, string> = {
  OUTSTANDING_BALANCE: "Saldo pendiente",
  PAYMENT_PENDING: "Sin pago registrado",
  SALE_CANCELLED: "Venta cancelada",
  NO_INITIAL_PAYMENT: "Sin pago inicial",
  PARTIAL_PAYMENT: "Pago parcial",
};

function humanizePendingReasonCode(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((segment, index) =>
      index === 0 ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment
    )
    .join(" ");
}

export function getSalePendingReasonLabel(value: unknown) {
  const normalized = toOptionalText(value);
  if (!normalized) return undefined;

  const knownLabel = KNOWN_PENDING_REASON_LABELS[normalized];
  if (knownLabel) return knownLabel;

  if (/^[A-Z0-9_]+$/.test(normalized)) {
    return humanizePendingReasonCode(normalized);
  }

  return normalized;
}

function normalizeSaleLineItem(
  item: SaleDetail["items"][number]
): SaleLineItemViewModel {
  const quantity = toFiniteNumber(item.quantity, 0);
  const unitPrice = toFiniteNumber(item.unitPrice, 0);

  return {
    productId: String(item.productId ?? ""),
    productName:
      toOptionalText(item.productName) ??
      toOptionalText((item as { name?: unknown }).name) ??
      toOptionalText(
        (
          item as {
            product?: { name?: unknown } | null;
          }
        ).product?.name
      ) ??
      String(item.productId ?? "Producto"),
    quantity,
    unitPrice,
    subtotal: toFiniteNumber(item.subtotal, quantity * unitPrice),
    linkedProductId: item.linkedProductId,
    pricingMode: item.pricingMode,
    requestedPriceType: item.requestedPriceType,
    priceType: item.priceType,
    pricingSource: item.pricingSource,
    baseRetailPrice: toOptionalFiniteNumber(item.baseRetailPrice),
    baseWholesalePrice: toOptionalFiniteNumber(item.baseWholesalePrice),
    pricingRuleSnapshot: item.pricingRuleSnapshot,
    manualOverrideReason: item.manualOverrideReason ?? null,
  };
}

function normalizeSalePayment(
  payment: ApiSalePayment | SalePaymentInput,
  fallbackDate: string
): SalePaymentViewModel {
  return {
    id: "id" in payment ? payment.id : undefined,
    amount: toFiniteNumber(payment.amount, 0),
    method: normalizeSalePaymentMethodKey(payment.method ?? "OTHER"),
    reference: toOptionalText(payment.reference),
    notes: toOptionalText(payment.notes),
    receivedAmount: toOptionalFiniteNumber(
      (payment as ApiSalePayment).receivedAmount
    ),
    changeAmount: toOptionalFiniteNumber((payment as ApiSalePayment).changeAmount),
    cancelledAt: (payment as ApiSalePayment).cancelledAt ?? null,
    date: normalizeIsoDate(
      (payment as ApiSalePayment).createdAt,
      (payment as ApiSalePayment).updatedAt,
      payment.paidAt,
      fallbackDate
    ),
  };
}

function normalizeChargeStatus(
  row: SaleSummary,
  paidAmount: number,
  outstandingAmount: number
): SaleChargeStatus {
  const canonicalStatus = toOptionalText(row.chargeStatus);
  if (
    canonicalStatus === "PAID" ||
    canonicalStatus === "PARTIALLY_PAID" ||
    canonicalStatus === "PENDING"
  ) {
    return canonicalStatus;
  }

  const legacyStatus = toOptionalText(row.paymentStatus);
  if (
    legacyStatus === "PAID" ||
    legacyStatus === "PARTIALLY_PAID" ||
    legacyStatus === "PENDING"
  ) {
    return legacyStatus;
  }

  if (outstandingAmount <= 0) return "PAID";
  if (paidAmount > 0) return "PARTIALLY_PAID";
  return "PENDING";
}

function normalizeLifecycleStatus(row: SaleSummary): SaleLifecycleStatus {
  const canonicalStatus = toOptionalText(row.lifecycleStatus);
  if (canonicalStatus === "ACTIVE" || canonicalStatus === "CANCELLED") {
    return canonicalStatus;
  }

  const legacyStatus = toOptionalText(row.status)?.toUpperCase();
  if (
    legacyStatus === "CANCELLED" ||
    toOptionalText(row.cancelledAt) ||
    toOptionalText(row.deletedAt)
  ) {
    return "CANCELLED";
  }

  return "ACTIVE";
}

function normalizePaymentType(
  row: SaleSummary,
  paymentBreakdownByMethod: SalePaymentBreakdownByMethod
): SalePaymentType {
  const canonicalType = toOptionalText(row.paymentType);
  if (
    canonicalType === "CASH" ||
    canonicalType === "TRANSFER" ||
    canonicalType === "MIXED" ||
    canonicalType === "OTHER"
  ) {
    return canonicalType;
  }

  return classifySalePaymentType(paymentBreakdownByMethod);
}

export function normalizeSale(
  row: SaleSummary | SaleDetail,
  options: {
    businessType: BusinessType;
  }
): SaleViewModel {
  const createdAt = normalizeIsoDate(row.createdAt, row.updatedAt);
  const updatedAt = normalizeIsoDate(row.updatedAt, row.createdAt);
  const lineItems = Array.isArray((row as SaleDetail).items)
    ? (row as SaleDetail).items.map(normalizeSaleLineItem)
    : [];
  const detailPayments = (row as SaleDetail).payments;
  const payments = Array.isArray(detailPayments)
    ? detailPayments.map((payment) => normalizeSalePayment(payment, createdAt))
    : [];
  const computedTotal = lineItems.reduce(
    (sum, item) => sum + toFiniteNumber(item.subtotal, item.quantity * item.unitPrice),
    0
  );
  const totalAmount = toFiniteNumber(row.totalAmount ?? row.total, computedTotal);
  const normalizedPaymentBreakdown = normalizeSalePaymentBreakdown(
    row.paymentBreakdown
  );
  const paymentBreakdown =
    Object.keys(normalizedPaymentBreakdown).length > 0
      ? normalizedPaymentBreakdown
      : payments.reduce<Record<string, number>>((acc, payment) => {
          const method = normalizeSalePaymentMethodKey(payment.method);
          if (!method) return acc;
          acc[method] = toFiniteNumber(acc[method], 0) + payment.amount;
          return acc;
        }, {});
  const paymentBreakdownByMethod = getSalePaymentBreakdownByMethod(
    row.paymentBreakdownByMethod ?? row.paymentBreakdown
  );

  if (
    paymentBreakdownByMethod.cash <= Number.EPSILON &&
    paymentBreakdownByMethod.transfer <= Number.EPSILON &&
    paymentBreakdownByMethod.card <= Number.EPSILON &&
    paymentBreakdownByMethod.other <= Number.EPSILON
  ) {
    payments.forEach((payment) => {
      const method = normalizeSalePaymentMethodKey(payment.method);
      if (method === "CASH") {
        paymentBreakdownByMethod.cash += payment.amount;
        return;
      }
      if (method === "TRANSFER") {
        paymentBreakdownByMethod.transfer += payment.amount;
        return;
      }
      if (
        method === "CARD" ||
        method === "DEBIT_CARD" ||
        method === "CREDIT_CARD"
      ) {
        paymentBreakdownByMethod.card += payment.amount;
        return;
      }
      paymentBreakdownByMethod.other += payment.amount;
    });
  }

  const paidAmount = toFiniteNumber(
    row.paidAmount,
    Object.values(paymentBreakdown).reduce((sum, value) => sum + value, 0)
  );
  const outstandingAmount = Math.max(
    0,
    toFiniteNumber(row.outstandingAmount, totalAmount - paidAmount)
  );
  const chargeStatus = normalizeChargeStatus(row, paidAmount, outstandingAmount);
  const lifecycleStatus = normalizeLifecycleStatus(row);
  const itemsFromDetail = lineItems.reduce((sum, item) => sum + item.quantity, 0);
  const itemsCount = Math.max(
    0,
    Math.round(toFiniteNumber(row.itemsCount, lineItems.length))
  );
  const itemsQuantity = Math.max(
    0,
    toFiniteNumber(row.itemsQuantity, itemsFromDetail)
  );
  const paymentMethods = Object.entries(paymentBreakdown)
    .filter(([, amount]) => toFiniteNumber(amount, 0) > Number.EPSILON)
    .map(([method]) => method);
  const paymentType = normalizePaymentType(row, paymentBreakdownByMethod);
  const note = toOptionalText(row.note);
  const notesRaw =
    toOptionalText(row.notesRaw) ??
    toOptionalText(row.originalNotes) ??
    toOptionalText(row.notes);
  const originalNotes = toOptionalText(row.originalNotes) ?? notesRaw;
  const parsedNotes = parseSaleNotesPayload(originalNotes ?? notesRaw);
  const hasBackendPendingReason = toOptionalText(row.pendingReason) != null;
  const pendingReason =
    (hasBackendPendingReason ? parsedNotes.pendingReason : undefined) ??
    toOptionalText(row.pendingReason) ??
    (outstandingAmount > 0 && !note && !parsedNotes.note ? originalNotes : undefined);
  const pendingReasonLabel = getSalePendingReasonLabel(pendingReason);
  const normalizedNote =
    note ??
    parsedNotes.note ??
    (parsedNotes.isStructured ? undefined : originalNotes);

  const normalized: SaleViewModel = {
    id: String(row.id ?? ""),
    amount: totalAmount,
    totalAmount,
    totalCost: toFiniteNumber(row.totalCost, 0),
    profit: toFiniteNumber(row.profit, 0),
    paidAmount,
    outstandingAmount,
    chargeStatus,
    legacyChargeStatus:
      row.paymentStatus && row.paymentStatus !== chargeStatus
        ? row.paymentStatus
        : undefined,
    lifecycleStatus,
    customerName: row.clientId ? `Cliente ${row.clientId}` : "Consumidor Final",
    items: itemsQuantity,
    itemsCount,
    itemsQuantity,
    paymentBreakdown,
    paymentBreakdownByMethod,
    paymentType,
    paymentMethods,
    pendingReason,
    pendingReasonLabel,
    note: normalizedNote,
    notes: normalizedNote,
    notesRaw,
    originalNotes,
    date: createdAt,
    createdAt,
    updatedAt,
    businessType: options.businessType,
    userId: String(row.userId ?? "unknown"),
    userName:
      toOptionalText(row.userName) ??
      toOptionalText(
        (
          row as {
            user?: { email?: unknown } | null;
          }
        ).user?.email
      ) ??
      "Usuario",
    branchId: String(row.branchId ?? ""),
    status: chargeStatus === "PENDING" ? "PENDING" : "COMPLETED",
  };

  if (Array.isArray((row as SaleDetail).items) || Array.isArray((row as SaleDetail).payments)) {
    normalized.lineItems = lineItems;
    normalized.payments = payments;
  }

  return normalized;
}

export function ensureSaleDetail(
  sale: SaleViewModel
): SaleDetailViewModel {
  return {
    ...sale,
    lineItems: sale.lineItems ?? [],
    payments: sale.payments ?? [],
  };
}
