// Datos de Reportes → "Cajas del mes" (components/reports/cash-calendar-report.tsx).
// La pantalla los pide con SWR, solo cuando la pestaña está abierta.
import { backendApi } from "@/lib/backend-api";
import {
  buildCashOverviewFromLegacyDailyBook,
  buildCashOverviewFromLegacyMonthly,
  normalizeCashOverviewResponse,
  type CashOverviewResult,
  type CashOverviewRow,
} from "@/lib/adapters/cash-overview";
import type { CashBookDailyResponse } from "@/lib/api-types";

export const DAILY_ENTRIES_FETCH_LIMIT = 500;

export type MonthlyCashRange = {
  fromMonth: string;
  toMonth: string;
  fromDate: string;
  toDate: string;
};

/** Resumen de los 6 meses visibles. Si la ruta nueva falla, usa la vieja (igual que antes). */
export async function fetchMonthlyCashOverview(
  branchId: string,
  range: MonthlyCashRange
): Promise<CashOverviewResult> {
  try {
    const payload = await backendApi.reporting.cash.overview(
      {
        branchId,
        from: range.fromDate,
        to: range.toDate,
        groupBy: "month",
      },
      branchId,
      undefined
    );
    return normalizeCashOverviewResponse(payload, {
      from: range.fromDate,
      to: range.toDate,
      groupBy: "month",
    });
  } catch {
    const payload = await backendApi.reporting.cash.monthly(
      {
        branchId,
        fromMonth: range.fromMonth,
        toMonth: range.toMonth,
      },
      branchId,
      undefined
    );
    return buildCashOverviewFromLegacyMonthly(payload, {
      from: range.fromDate,
      to: range.toDate,
    });
  }
}

export type DailyCash = {
  payload: CashBookDailyResponse;
  dayOverview: CashOverviewRow | null;
  sessionRows: CashOverviewRow[];
};

/**
 * El libro del día y sus dos resúmenes (por día y por turno), pedidos juntos:
 * antes los resúmenes esperaban a que terminara el libro. Si falla un resumen,
 * se arman desde el libro, igual que antes; si falla el libro, falla todo.
 */
export async function fetchDailyCash(branchId: string, date: string): Promise<DailyCash> {
  const [book, day, session] = await Promise.allSettled([
    backendApi.cash.dailyBook(
      {
        date,
        page: 1,
        limit: DAILY_ENTRIES_FETCH_LIMIT,
      },
      branchId
    ),
    backendApi.reporting.cash.overview(
      {
        branchId,
        from: date,
        to: date,
        groupBy: "day",
      },
      branchId
    ),
    backendApi.reporting.cash.overview(
      {
        branchId,
        from: date,
        to: date,
        groupBy: "session",
      },
      branchId
    ),
  ]);
  if (book.status === "rejected") throw book.reason;
  const payload = book.value;

  try {
    if (day.status === "rejected") throw day.reason;
    if (session.status === "rejected") throw session.reason;
    return {
      payload,
      dayOverview:
        normalizeCashOverviewResponse(day.value, {
          from: date,
          to: date,
          groupBy: "day",
        }).items[0] ?? null,
      sessionRows: normalizeCashOverviewResponse(session.value, {
        from: date,
        to: date,
        groupBy: "session",
      }).items,
    };
  } catch {
    return {
      payload,
      dayOverview:
        buildCashOverviewFromLegacyDailyBook(payload, "day").items[0] ?? null,
      sessionRows: buildCashOverviewFromLegacyDailyBook(payload, "session").items,
    };
  }
}

