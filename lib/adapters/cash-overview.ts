import type {
  CashBookDailyResponse,
  CashBookEntry,
  CashOverviewGroupBy,
  CashSession,
  ReportsCashOverviewItem,
  ReportsCashOverviewQuery,
  ReportsCashOverviewResponse,
  ReportsCashMonthlyResponse,
} from "../api-types";
import {
  isRecord,
  toFiniteNumber,
  toOptionalFiniteNumber,
  toOptionalText,
} from "./utils";

const CASH_PURCHASE_REASON_PREFIX = "compra con caja";

export interface CashOverviewRow {
  key: string;
  label: string;
  groupBy: CashOverviewGroupBy;
  date?: string | null;
  month?: string | null;
  sessionId?: string | null;
  cashSales: number;
  transferSales: number;
  salesTotal: number;
  manualIncome: number;
  cashPurchases: number;
  withdrawalsGross: number;
  withdrawalsNet: number;
  netTotal: number;
  countedCash?: number | null;
  expectedCash?: number | null;
  difference?: number | null;
  source: Record<string, unknown>;
  unclassifiedOutflow?: number;
  outflowClassificationStatus?: string;
}

export interface CashOverviewResult {
  range: {
    from: string;
    to: string;
  };
  groupBy: CashOverviewGroupBy;
  items: CashOverviewRow[];
  totals?: CashOverviewRow | null;
}

function toTimestamp(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isCashPurchaseEntry(entry: CashBookEntry) {
  if (entry.direction !== "OUT") {
    return false;
  }

  const label =
    entry.notes?.trim() ||
    entry.description?.trim() ||
    entry.reference?.trim() ||
    "";

  return label.toLowerCase().startsWith(CASH_PURCHASE_REASON_PREFIX);
}

function entryBelongsToSession(entry: CashBookEntry, session: CashSession) {
  if (entry.sessionId && entry.sessionId === session.id) {
    return true;
  }

  const createdAt = toTimestamp(entry.createdAt);
  const openedAt = toTimestamp(session.openedAt);
  if (createdAt === null || openedAt === null) {
    return false;
  }

  const closedAt = toTimestamp(session.closedAt);
  if (closedAt === null) {
    return createdAt >= openedAt;
  }

  return createdAt >= openedAt && createdAt <= closedAt;
}

function buildCashOverviewRow(
  raw: Partial<CashOverviewRow> &
    Pick<CashOverviewRow, "groupBy" | "key" | "label"> & {
      source?: Record<string, unknown>;
    }
): CashOverviewRow {
  const cashSales = toFiniteNumber(raw.cashSales, 0);
  const transferSales = toFiniteNumber(raw.transferSales, 0);
  const salesTotal = toFiniteNumber(raw.salesTotal, cashSales + transferSales);
  const manualIncome = toFiniteNumber(raw.manualIncome, 0);
  const cashPurchases = toFiniteNumber(raw.cashPurchases, 0);
  const withdrawalsGross = toFiniteNumber(raw.withdrawalsGross, 0);
  const unclassifiedOutflow = toOptionalFiniteNumber(raw.unclassifiedOutflow);
  const classifiedOutflowDiscount = cashPurchases + (unclassifiedOutflow ?? 0);
  const withdrawalsNet = toFiniteNumber(
    raw.withdrawalsNet,
    Math.max(0, withdrawalsGross - classifiedOutflowDiscount)
  );

  return {
    key: raw.key,
    label: raw.label,
    groupBy: raw.groupBy,
    date: raw.date ?? null,
    month: raw.month ?? null,
    sessionId: raw.sessionId ?? null,
    cashSales,
    transferSales,
    salesTotal,
    manualIncome,
    cashPurchases,
    withdrawalsGross,
    withdrawalsNet,
    netTotal: toFiniteNumber(
      raw.netTotal,
      salesTotal + manualIncome - withdrawalsGross
    ),
    countedCash: raw.countedCash ?? null,
    expectedCash: raw.expectedCash ?? null,
    difference: raw.difference ?? null,
    source: raw.source ?? {},
    unclassifiedOutflow: unclassifiedOutflow ?? undefined,
    outflowClassificationStatus: raw.outflowClassificationStatus,
  };
}

function normalizeCashOverviewItem(
  item: ReportsCashOverviewItem,
  groupBy: CashOverviewGroupBy,
  index: number
): CashOverviewRow {
  const source = isRecord(item.source) ? item.source : {};
  const date = toOptionalText(item.date) ?? toOptionalText(item.period);
  const month =
    toOptionalText(item.month) ??
    (groupBy === "month" ? toOptionalText(item.period) : undefined);
  const sessionId = toOptionalText(item.sessionId);
  const key =
    toOptionalText(item.key) ??
    toOptionalText(item.id) ??
    month ??
    date ??
    sessionId ??
    `${groupBy}-${index + 1}`;
  const label =
    toOptionalText(item.label) ??
    (groupBy === "session"
      ? sessionId
        ? `Sesion ${sessionId.slice(0, 6)}`
        : `Sesion ${index + 1}`
      : month ?? date ?? key);

  return buildCashOverviewRow({
    key,
    label,
    groupBy,
    date: date ?? null,
    month: month ?? null,
    sessionId: sessionId ?? null,
    cashSales: toFiniteNumber(item.cashSales, 0),
    transferSales: toFiniteNumber(item.transferSales, 0),
    salesTotal: toFiniteNumber(item.salesTotal, Number.NaN),
    manualIncome: toFiniteNumber(item.manualIncome, 0),
    cashPurchases: toFiniteNumber(item.cashPurchases, 0),
    withdrawalsGross: toFiniteNumber(item.withdrawalsGross, 0),
    withdrawalsNet: toFiniteNumber(item.withdrawalsNet, Number.NaN),
    netTotal: toFiniteNumber(item.netTotal, Number.NaN),
    countedCash: toOptionalFiniteNumber(item.countedCash) ?? null,
    expectedCash: toOptionalFiniteNumber(item.expectedCash) ?? null,
    difference: toOptionalFiniteNumber(item.difference) ?? null,
    source,
    unclassifiedOutflow:
      toOptionalFiniteNumber(source.unclassifiedOutflow) ?? undefined,
    outflowClassificationStatus:
      toOptionalText(source.outflowClassificationStatus) ?? undefined,
  });
}

export function normalizeCashOverviewResponse(
  payload: ReportsCashOverviewResponse,
  query: Pick<ReportsCashOverviewQuery, "from" | "to" | "groupBy">
): CashOverviewResult {
  const groupBy = payload.groupBy ?? query.groupBy;
  const items = Array.isArray(payload.items)
    ? payload.items.map((item, index) =>
        normalizeCashOverviewItem(item, groupBy, index)
      )
    : [];
  const totals = payload.totals
    ? normalizeCashOverviewItem(payload.totals, groupBy, items.length)
    : null;

  return {
    range: {
      from: toOptionalText(payload.range?.from) ?? query.from,
      to: toOptionalText(payload.range?.to) ?? query.to,
    },
    groupBy,
    items,
    totals,
  };
}

export function buildCashOverviewFromLegacyMonthly(
  payload: ReportsCashMonthlyResponse,
  query: Pick<ReportsCashOverviewQuery, "from" | "to">
): CashOverviewResult {
  return {
    range: {
      from: query.from,
      to: query.to,
    },
    groupBy: "month",
    items: (payload.items ?? []).map((item) =>
      buildCashOverviewRow({
        key: item.month,
        label: item.month,
        groupBy: "month",
        month: item.month,
        cashSales: item.cashFromSales,
        transferSales: item.transferFromSales,
        manualIncome: item.manualIn,
        cashPurchases: 0,
        withdrawalsGross: item.manualOut,
        withdrawalsNet: 0,
        netTotal:
          Number(item.cashFromSales ?? 0) +
          Number(item.transferFromSales ?? 0) +
          Number(item.manualIn ?? 0) -
          Number(item.manualOut ?? 0),
        countedCash: item.countedCashClose,
        expectedCash: item.expectedCashClose,
        difference: item.difference,
        source: {
          legacy: true,
          unclassifiedOutflow: item.manualOut,
          outflowClassificationStatus: "LEGACY_UNCLASSIFIED",
          sessionsCount: item.sessionsCount,
          daysWithClose: item.daysWithClose,
        },
        unclassifiedOutflow: Number(item.manualOut ?? 0),
        outflowClassificationStatus: "LEGACY_UNCLASSIFIED",
      })
    ),
    totals: null,
  };
}

export function buildCashOverviewFromLegacyDailyBook(
  payload: CashBookDailyResponse,
  groupBy: Extract<CashOverviewGroupBy, "day" | "session">
): CashOverviewResult {
  const cashPurchaseEntries = (payload.entries ?? []).filter((entry) =>
    isCashPurchaseEntry(entry)
  );
  const cashPurchasesTotal = cashPurchaseEntries.reduce(
    (sum, entry) => sum + Number(entry.amount ?? 0),
    0
  );
  const reportedOutflowTotal = Number(payload.summary.outflow.movementOut ?? 0);

  if (groupBy === "day") {
    return {
      range: {
        from: payload.date,
        to: payload.date,
      },
      groupBy,
      items: [
        buildCashOverviewRow({
          key: payload.date,
          label: payload.date,
          groupBy,
          date: payload.date,
          cashSales: payload.summary.income.cashFromPayments,
          transferSales: payload.summary.income.transferFromPayments,
          manualIncome: payload.summary.income.movementIn,
          cashPurchases: cashPurchasesTotal,
          withdrawalsGross: reportedOutflowTotal,
          withdrawalsNet: Math.max(0, reportedOutflowTotal - cashPurchasesTotal),
          countedCash: payload.summary.countedCash,
          expectedCash: payload.summary.expectedCash,
          difference: payload.summary.difference,
          source: {
            legacy: true,
            differenceSource: payload.summary.differenceSource,
          },
          outflowClassificationStatus:
            cashPurchaseEntries.length > 0 ? "LEGACY_HEURISTIC" : "LEGACY",
        }),
      ],
      totals: null,
    };
  }

  const cashPurchasesBySessionId = new Map<string, number>();
  cashPurchaseEntries.forEach((entry) => {
    const session = (payload.sessions ?? []).find((candidate) =>
      entryBelongsToSession(entry, candidate)
    );
    if (!session) return;
    cashPurchasesBySessionId.set(
      session.id,
      (cashPurchasesBySessionId.get(session.id) ?? 0) + Number(entry.amount ?? 0)
    );
  });

  return {
    range: {
      from: payload.date,
      to: payload.date,
    },
    groupBy,
    items: (payload.sessions ?? []).map((session, index) => {
      const cashSales = Number(session.totals?.cashPayments ?? 0);
      const transferSales = Number(session.totals?.transferPayments ?? 0);
      const manualIncome = Number(session.totals?.movementIn ?? 0);
      const cashPurchases = Number(cashPurchasesBySessionId.get(session.id) ?? 0);
      const withdrawalsGross = Number(session.totals?.movementOut ?? 0);

      return buildCashOverviewRow({
        key: session.id,
        label: `Sesion ${index + 1}`,
        groupBy,
        date: payload.date,
        sessionId: session.id,
        cashSales,
        transferSales,
        manualIncome,
        cashPurchases,
        withdrawalsGross,
        withdrawalsNet: Math.max(0, withdrawalsGross - cashPurchases),
        countedCash:
          session.status === "CLOSED"
            ? Number(session.countedCash ?? 0)
            : null,
        expectedCash: Number(session.expectedCash ?? 0),
        difference:
          session.status === "CLOSED" ? Number(session.difference ?? 0) : null,
        source: {
          legacy: true,
          sessionId: session.id,
          openedAt: session.openedAt,
          closedAt: session.closedAt,
          status: session.status,
          openingFloat: session.openingFloat,
        },
        outflowClassificationStatus:
          cashPurchases > 0 ? "LEGACY_HEURISTIC" : "LEGACY",
      });
    }),
    totals: null,
  };
}

export function getCashOutflowLabel(row: CashOverviewRow) {
  if ((row.unclassifiedOutflow ?? 0) > 0) {
    return "Retiros/compras no clasificados";
  }
  if (row.cashPurchases > 0 && row.withdrawalsNet > 0) {
    return "Retiros + compras con caja";
  }
  if (row.cashPurchases > 0) {
    return "Compras con caja";
  }
  return "Retiros de caja";
}
