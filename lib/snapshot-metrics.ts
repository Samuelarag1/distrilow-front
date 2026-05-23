import type { SnapshotPeriod } from "./api-types";

export interface NormalizedSnapshotMetrics {
  period?: SnapshotPeriod;
  scope?: "active" | "all";
  range?: {
    from?: string;
    to?: string;
  };
  history?: Array<{
    period: string;
    totalIncome?: number;
    operationalExpenses?: number;
    totalCostOfGoods?: number;
    netProfit?: number;
  }>;
  totalRevenue: number;
  totalOrders: number;
  activeCustomers: number;
  lowStockItems: number;
  dailyCashbox?: number;
  dailyCashBreakdown?: {
    openingFloat: number;
    cashFromPayments: number;
    movementIn: number;
    movementOut: number;
  };
  walkInCustomers?: number;
  pendingBulkOrders?: number;
  creditUtilized?: number;
  operationalExpenses?: number;
  totalCostOfGoods?: number;
  netProfit?: number;
  averageTicket?: number;
  growthTrend?: number;
  retentionRate?: string;
}

type RecordLike = Record<string, unknown>;
export const SNAPSHOT_REPORTING_TIME_ZONE = "America/Argentina/Cordoba";

const snapshotDateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: SNAPSHOT_REPORTING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const snapshotYmdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SNAPSHOT_REPORTING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function asRecord(value: unknown): RecordLike {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as RecordLike;
  }
  return {};
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSnapshotPeriod(value: unknown): SnapshotPeriod | undefined {
  if (
    value === "monthly" ||
    value === "quarterly" ||
    value === "semiannual" ||
    value === "annual"
  ) {
    return value;
  }
  return undefined;
}

function normalizeSnapshotScope(value: unknown): "active" | "all" | undefined {
  if (value === "active" || value === "all") {
    return value;
  }
  return undefined;
}

function normalizeSnapshotHistoryPoint(value: unknown) {
  const source = asRecord(value);
  const period = toOptionalString(source.period);
  if (!period) return null;

  return {
    period,
    totalIncome: toOptionalNumber(source.totalIncome),
    operationalExpenses: toOptionalNumber(source.operationalExpenses),
    totalCostOfGoods: toOptionalNumber(source.totalCostOfGoods),
    netProfit: toOptionalNumber(source.netProfit),
  };
}

export function formatSnapshotDate(value?: string) {
  const text = toOptionalString(value);
  if (!text) return null;

  const exactDate = extractSnapshotDateKey(text);
  if (exactDate) {
    const [, year, month, day] = exactDate.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
  }

  const parsedDate = new Date(text);
  if (!Number.isFinite(parsedDate.getTime())) {
    const leadingDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!leadingDate) return text;
    return `${leadingDate[3]}/${leadingDate[2]}/${leadingDate[1]}`;
  }

  return snapshotDateFormatter.format(parsedDate);
}

export function extractSnapshotDateKey(value?: string) {
  const text = toOptionalString(value);
  if (!text) return null;

  const exactDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactDate) {
    return `${exactDate[1]}-${exactDate[2]}-${exactDate[3]}`;
  }

  const leadingDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (leadingDate) {
    return `${leadingDate[1]}-${leadingDate[2]}-${leadingDate[3]}`;
  }

  const parsedDate = new Date(text);
  if (!Number.isFinite(parsedDate.getTime())) return null;

  return snapshotYmdFormatter.format(parsedDate);
}

export function snapshotDateKeyToStableDate(value?: string) {
  const key = extractSnapshotDateKey(value);
  if (!key) return null;

  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function formatSnapshotRangeLabel(
  range?: NormalizedSnapshotMetrics["range"]
) {
  const fromLabel = formatSnapshotDate(range?.from);
  const toLabel = formatSnapshotDate(range?.to);

  if (fromLabel && toLabel) {
    return fromLabel === toLabel ? fromLabel : `${fromLabel} al ${toLabel}`;
  }
  return fromLabel ?? toLabel ?? null;
}

export function normalizeSnapshotMetrics(
  snapshot: unknown
): NormalizedSnapshotMetrics {
  const source = asRecord(snapshot);
  const summary = asRecord(source.summary);
  const inventory = asRecord(source.inventory);
  const salesAnalysis = asRecord(source.salesAnalysis);
  const range = asRecord(source.range);
  const rangeFrom = toOptionalString(range.from);
  const rangeTo = toOptionalString(range.to);
  const normalizedHistory = Array.isArray(source.history)
    ? source.history
        .map(normalizeSnapshotHistoryPoint)
        .filter((point): point is NonNullable<typeof point> => Boolean(point))
    : [];

  const normalized: NormalizedSnapshotMetrics = {
    period: normalizeSnapshotPeriod(source.period),
    scope: normalizeSnapshotScope(source.scope),
    totalRevenue: toNumber(
      source.totalRevenue ?? source.totalIncome ?? summary.totalIncome,
      0
    ),
    totalOrders: toNumber(
      source.totalOrders ?? source.totalSales ?? salesAnalysis.totalSales,
      0
    ),
    activeCustomers: toNumber(
      source.activeCustomers ?? source.uniqueClients ?? salesAnalysis.uniqueClients,
      0
    ),
    lowStockItems: toNumber(
      source.lowStockItems ??
        source.lowStockProducts ??
        inventory.lowStockProducts,
      0
    ),
  };

  if (rangeFrom || rangeTo) {
    normalized.range = {
      from: rangeFrom,
      to: rangeTo,
    };
  }
  if (normalizedHistory.length > 0) {
    normalized.history = normalizedHistory;
  }

  const dailyCashbox = toOptionalNumber(
    source.dailyCashbox ?? source.dailyCash ?? summary.dailyCash
  );
  const dailyCashBreakdown = asRecord(summary.dailyCashBreakdown);
  const openingFloat = toOptionalNumber(dailyCashBreakdown.openingFloat);
  const cashFromPayments = toOptionalNumber(dailyCashBreakdown.cashFromPayments);
  const movementIn = toOptionalNumber(dailyCashBreakdown.movementIn);
  const movementOut = toOptionalNumber(dailyCashBreakdown.movementOut);
  const hasCompleteBreakdown =
    openingFloat !== undefined &&
    cashFromPayments !== undefined &&
    movementIn !== undefined &&
    movementOut !== undefined;
  const computedDailyCash = hasCompleteBreakdown
    ? openingFloat + cashFromPayments + movementIn - movementOut
    : undefined;

  if (hasCompleteBreakdown) {
    normalized.dailyCashBreakdown = {
      openingFloat,
      cashFromPayments,
      movementIn,
      movementOut,
    };
  }
  if (dailyCashbox !== undefined) {
    normalized.dailyCashbox = dailyCashbox;
  } else if (computedDailyCash !== undefined) {
    normalized.dailyCashbox = computedDailyCash;
  }

  const walkInCustomers = toOptionalNumber(source.walkInCustomers);
  if (walkInCustomers !== undefined) normalized.walkInCustomers = walkInCustomers;

  const pendingBulkOrders = toOptionalNumber(source.pendingBulkOrders);
  if (pendingBulkOrders !== undefined) {
    normalized.pendingBulkOrders = pendingBulkOrders;
  }

  const creditUtilized = toOptionalNumber(source.creditUtilized);
  if (creditUtilized !== undefined) normalized.creditUtilized = creditUtilized;

  const operationalExpenses = toOptionalNumber(
    source.operationalExpenses ?? summary.operationalExpenses
  );
  if (operationalExpenses !== undefined) {
    normalized.operationalExpenses = operationalExpenses;
  }

  const totalCostOfGoods = toOptionalNumber(
    source.totalCostOfGoods ?? summary.totalCostOfGoods
  );
  if (totalCostOfGoods !== undefined) {
    normalized.totalCostOfGoods = totalCostOfGoods;
  }

  const netProfit = toOptionalNumber(source.netProfit ?? summary.netProfit);
  if (netProfit !== undefined) normalized.netProfit = netProfit;

  const averageTicket = toOptionalNumber(
    source.averageTicket ?? salesAnalysis.averageTicket
  );
  if (averageTicket !== undefined) normalized.averageTicket = averageTicket;

  const growthTrend = toOptionalNumber(
    source.growthTrend ?? salesAnalysis.growthTrend
  );
  if (growthTrend !== undefined) normalized.growthTrend = growthTrend;

  const retentionRate = toOptionalString(source.retentionRate);
  if (retentionRate !== undefined) normalized.retentionRate = retentionRate;

  return normalized;
}
