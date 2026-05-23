"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  History,
  Info,
  RefreshCcw,
  Ticket,
  Wallet,
} from "lucide-react";

import { backendApi } from "@/lib/backend-api";
import { useUser } from "@/components/providers/user-provider";
import { subscribeCashSync } from "@/lib/cash-live-sync";
import { subscribeExpensesSync } from "@/lib/expenses-live-sync";
import { BrandSpinner } from "@/components/common/brand-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { exportRowsToPdf } from "@/lib/report-export";
import {
  buildCashOverviewFromLegacyDailyBook,
  buildCashOverviewFromLegacyMonthly,
  getCashOutflowLabel,
  normalizeCashOverviewResponse,
  type CashOverviewResult,
  type CashOverviewRow,
} from "@/lib/adapters/cash-overview";

import type {
  CashBookEntry,
  CashBookDailyResponse,
  CashSession,
} from "@/lib/api-types";

function formatMoney(value: number, maximumFractionDigits = 2) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits,
  });
}

function parseMonthDate(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const monthOnlyMatch = normalized.match(/^(\d{4})-(\d{2})$/);
  if (monthOnlyMatch) {
    const parsed = new Date(`${normalized}-01T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const fullDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullDateMatch) {
    const parsed = new Date(`${normalized}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMonthValue(value: unknown, pattern: string) {
  const parsed = parseMonthDate(value);
  if (!parsed) {
    return typeof value === "string" && value.trim() ? value : "-";
  }

  return format(parsed, pattern, { locale: es });
}

function emptyDailyResponse(date: string): CashBookDailyResponse {
  return {
    date,
    branchId: "",
    summary: {
      openingFloat: 0,
      expectedCash: 0,
      countedCash: 0,
      difference: 0,
      movementBalance: 0,
      income: {
        cashFromPayments: 0,
        transferFromPayments: 0,
        movementIn: 0,
      },
      outflow: {
        movementOut: 0,
      },
    },
    sessions: [],
    entries: [],
    meta: {
      total: 0,
      offset: 0,
      limit: 20,
      hasMore: false,
    },
  };
}

const DAILY_MOVEMENTS_LIMIT = 5;
const DAILY_ENTRIES_FETCH_LIMIT = 500;
function getEntryMethodLabel(method?: string | null) {
  if (method === "CASH") return "Efectivo";
  if (method === "TRANSFER") return "Transferencia";
  return method || "Otro";
}

function getEntryLabel(entry: CashBookEntry) {
  if (entry.sourceType === "SALE_PAYMENT") {
    const reference = entry.saleId || entry.reference || entry.id;
    return `Venta #${String(reference).slice(0, 6)}`;
  }
  if (entry.direction === "OUT") {
    return entry.notes?.trim() || "Retiro de caja";
  }
  return entry.notes?.trim() || "Movimiento de caja";
}

export function CashCalendarReport() {
  const { branchId } = useUser();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [monthlyOverview, setMonthlyOverview] =
    useState<CashOverviewResult | null>(null);
  const [dayOverview, setDayOverview] = useState<CashOverviewRow | null>(null);
  const [sessionOverviewRows, setSessionOverviewRows] = useState<CashOverviewRow[]>([]);
  const [dailyPayload, setDailyPayload] =
    useState<CashBookDailyResponse | null>(null);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);
  const [isDailyLoading, setIsDailyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDateYmd = useMemo(
    () => format(selectedDate, "yyyy-MM-dd"),
    [selectedDate]
  );

  const loadMonthly = useCallback(async () => {
    if (!branchId) {
      setMonthlyOverview(null);
      setError("No hay sucursal activa para consultar cajas.");
      return;
    }

    const fromMonth = format(subMonths(visibleMonth, 5), "yyyy-MM");
    const toMonth = format(visibleMonth, "yyyy-MM");
    const fromDate = `${fromMonth}-01`;
    const toDate = format(endOfMonth(visibleMonth), "yyyy-MM-dd");

    try {
      setIsMonthlyLoading(true);
      setError(null);

      try {
        const payload = await backendApi.reporting.cash.overview(
          {
            branchId,
            from: fromDate,
            to: toDate,
            groupBy: "month",
          },
          branchId,
          undefined
        );

        setMonthlyOverview(
          normalizeCashOverviewResponse(payload, {
            from: fromDate,
            to: toDate,
            groupBy: "month",
          })
        );
      } catch {
        const payload = await backendApi.reporting.cash.monthly(
          {
            branchId,
            fromMonth,
            toMonth,
          },
          branchId,
          undefined
        );

        setMonthlyOverview(
          buildCashOverviewFromLegacyMonthly(payload, {
            from: fromDate,
            to: toDate,
          })
        );
      }
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudo cargar el reporte mensual de cajas.";
      setError(message);
      setMonthlyOverview(null);
    } finally {
      setIsMonthlyLoading(false);
    }
  }, [branchId, visibleMonth]);

  const loadDaily = useCallback(async () => {
    if (!branchId) {
      setDayOverview(null);
      setSessionOverviewRows([]);
      setDailyPayload(emptyDailyResponse(selectedDateYmd));
      setError("No hay sucursal activa para consultar caja diaria.");
      return;
    }

    try {
      setIsDailyLoading(true);
      setError(null);

      const payload = await backendApi.cash.dailyBook(
        {
          date: selectedDateYmd,
          page: 1,
          limit: DAILY_ENTRIES_FETCH_LIMIT,
        },
        branchId
      );

      setDailyPayload(payload);

      try {
        const [dayPayload, sessionPayload] = await Promise.all([
          backendApi.reporting.cash.overview(
            {
              branchId,
              from: selectedDateYmd,
              to: selectedDateYmd,
              groupBy: "day",
            },
            branchId
          ),
          backendApi.reporting.cash.overview(
            {
              branchId,
              from: selectedDateYmd,
              to: selectedDateYmd,
              groupBy: "session",
            },
            branchId
          ),
        ]);

        setDayOverview(
          normalizeCashOverviewResponse(dayPayload, {
            from: selectedDateYmd,
            to: selectedDateYmd,
            groupBy: "day",
          }).items[0] ?? null
        );
        setSessionOverviewRows(
          normalizeCashOverviewResponse(sessionPayload, {
            from: selectedDateYmd,
            to: selectedDateYmd,
            groupBy: "session",
          }).items
        );
      } catch {
        setDayOverview(
          buildCashOverviewFromLegacyDailyBook(payload, "day").items[0] ?? null
        );
        setSessionOverviewRows(
          buildCashOverviewFromLegacyDailyBook(payload, "session").items
        );
      }
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudo cargar el libro diario de caja.";
      setError(message);
      setDayOverview(null);
      setSessionOverviewRows([]);
      setDailyPayload(emptyDailyResponse(selectedDateYmd));
    } finally {
      setIsDailyLoading(false);
    }
  }, [branchId, selectedDateYmd]);

  useEffect(() => {
    void loadMonthly();
  }, [loadMonthly]);

  useEffect(() => {
    void loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    const unsubCash = subscribeCashSync((payload) => {
      if (!payload.branchId || payload.branchId === branchId) {
        void loadMonthly();
        void loadDaily();
      }
    });
    const unsubEx = subscribeExpensesSync((payload) => {
      if (!payload.branchId || payload.branchId === branchId) {
        void loadDaily();
      }
    });

    return () => {
      unsubCash();
      unsubEx();
    };
  }, [branchId, loadDaily, loadMonthly]);

  useEffect(() => {
    if (isSameMonth(selectedDate, visibleMonth)) return;
    setSelectedDate(startOfMonth(visibleMonth));
  }, [selectedDate, visibleMonth]);

  const monthlyItems = useMemo(
    () =>
      (monthlyOverview?.items ?? [])
        .slice()
        .sort((a, b) =>
          String(a.month ?? a.label).localeCompare(String(b.month ?? b.label))
        ),
    [monthlyOverview?.items]
  );

  const selectedMonthKey = format(visibleMonth, "yyyy-MM");
  const selectedMonth = useMemo(
    () =>
      monthlyItems.find(
        (item) => item.month === selectedMonthKey || item.label === selectedMonthKey
      ) ??
      ({
        key: selectedMonthKey,
        label: selectedMonthKey,
        groupBy: "month",
        month: selectedMonthKey,
        cashSales: 0,
        transferSales: 0,
        salesTotal: 0,
        manualIncome: 0,
        cashPurchases: 0,
        withdrawalsGross: 0,
        withdrawalsNet: 0,
        netTotal: 0,
        expectedCash: 0,
        countedCash: 0,
        difference: 0,
        source: {},
      } satisfies CashOverviewRow),
    [monthlyItems, selectedMonthKey]
  );

  const monthlyChartData = useMemo(
    () =>
      monthlyItems.map((item) => ({
        month: item.month ?? item.label,
        esperado: Number(item.expectedCash ?? 0),
        contado: Number(item.countedCash ?? 0),
        diferencia: Number(item.difference ?? 0),
      })),
    [monthlyItems]
  );

  const latestClosedSession = useMemo(() => {
    if (!dailyPayload) return null;
    return (
      dailyPayload.sessions
        .filter((session) => session.status === "CLOSED" && !!session.closedAt)
        .sort(
          (a, b) =>
            new Date(b.closedAt ?? 0).getTime() -
            new Date(a.closedAt ?? 0).getTime()
        )[0] ?? null
    );
  }, [dailyPayload]);

  const sessionMetaById = useMemo(() => {
    const map = new Map<string, CashSession>();
    (dailyPayload?.sessions ?? []).forEach((session) => {
      map.set(session.id, session);
    });
    return map;
  }, [dailyPayload?.sessions]);

  const sessionSummaries = useMemo(
    () =>
      sessionOverviewRows.map((row, index) => {
        const session =
          (row.sessionId ? sessionMetaById.get(row.sessionId) : null) ??
          dailyPayload?.sessions?.[index] ??
          null;

        return {
          row,
          session,
        };
      }),
    [dailyPayload?.sessions, sessionMetaById, sessionOverviewRows]
  );

  const selectedDaySummary = useMemo(
    () =>
      dayOverview ??
      ({
        key: selectedDateYmd,
        label: selectedDateYmd,
        groupBy: "day",
        date: selectedDateYmd,
        cashSales: 0,
        transferSales: 0,
        salesTotal: 0,
        manualIncome: 0,
        cashPurchases: 0,
        withdrawalsGross: 0,
        withdrawalsNet: 0,
        netTotal: 0,
        countedCash: 0,
        expectedCash: 0,
        difference: 0,
        source: {},
      } satisfies CashOverviewRow),
    [dayOverview, selectedDateYmd]
  );

  const withdrawalsTotal = useMemo(
    () => Number(selectedDaySummary.withdrawalsNet ?? 0),
    [selectedDaySummary]
  );

  const cashIncomeTotal = useMemo(() => {
    return Number(selectedDaySummary.cashSales ?? 0);
  }, [selectedDaySummary]);

  const transferIncomeTotal = useMemo(
    () => Number(selectedDaySummary.transferSales ?? 0),
    [selectedDaySummary]
  );

  const manualIncomeTotal = useMemo(
    () => Number(selectedDaySummary.manualIncome ?? 0),
    [selectedDaySummary]
  );

  const cashPurchasesTotal = useMemo(
    () => Number(selectedDaySummary.cashPurchases ?? 0),
    [selectedDaySummary]
  );

  const dailyGrossIncomeTotal = useMemo(() => {
    return Number(selectedDaySummary.salesTotal ?? 0) + manualIncomeTotal;
  }, [manualIncomeTotal, selectedDaySummary]);

  const nextShiftAmount = useMemo(() => {
    if (
      latestClosedSession?.countedCash !== undefined &&
      latestClosedSession?.countedCash !== null
    ) {
      return Number(latestClosedSession.countedCash);
    }
    return Number(selectedDaySummary.countedCash ?? 0);
  }, [latestClosedSession, selectedDaySummary]);

  const exportDailyPdf = useCallback(() => {
    if (!dailyPayload) return;

    const sessionsSummary = sessionSummaries.map(({ row, session }, index) => ({
      label: session ? `Sesion ${index + 1}` : row.label,
      cashIncome: row.cashSales,
      transferIncome: row.transferSales,
      manualIncome: row.manualIncome,
      withdrawalsOut: row.withdrawalsNet,
      purchasesWithCash: row.cashPurchases,
      unclassifiedOutflow: row.unclassifiedOutflow ?? 0,
      sessionIncomeTotal: row.salesTotal + row.manualIncome,
      sessionNetTotal: row.netTotal,
      outflowLabel: getCashOutflowLabel(row),
    }));

    const totalCashIncome = sessionsSummary.reduce(
      (sum, session) => sum + session.cashIncome,
      0
    );
    const totalTransferIncome = sessionsSummary.reduce(
      (sum, session) => sum + session.transferIncome,
      0
    );
    const totalManualIncome = sessionsSummary.reduce(
      (sum, session) => sum + session.manualIncome,
      0
    );
    const totalWithdrawals = sessionsSummary.reduce(
      (sum, session) => sum + session.withdrawalsOut,
      0
    );
    const totalCashPurchases = sessionsSummary.reduce(
      (sum, session) => sum + session.purchasesWithCash,
      0
    );
    const totalUnclassifiedOutflow = sessionsSummary.reduce(
      (sum, session) => sum + session.unclassifiedOutflow,
      0
    );
    const totalIncome = dailyGrossIncomeTotal;
    const totalNetDay = Number(selectedDaySummary.netTotal ?? 0);

    const rows: Array<Record<string, unknown>> = [
      {
        seccion: "Resumen general",
        detalle: "Total ingreso efectivo",
        valor: formatMoney(totalCashIncome),
      },
      {
        seccion: "Resumen general",
        detalle: "Total ingreso transferencia",
        valor: formatMoney(totalTransferIncome),
      },
      {
        seccion: "Resumen general",
        detalle: "Total ingresos manuales",
        valor: formatMoney(totalManualIncome),
      },
      {
        seccion: "Resumen general",
        detalle: "Total retiros de caja",
        valor: `-${formatMoney(totalWithdrawals)}`,
      },
      {
        seccion: "Resumen general",
        detalle: "Total compras con caja",
        valor: `-${formatMoney(totalCashPurchases)}`,
      },
      ...(totalUnclassifiedOutflow > 0
        ? [
            {
              seccion: "Resumen general",
              detalle: "Retiros/compras no clasificados",
              valor: `-${formatMoney(totalUnclassifiedOutflow)}`,
            },
          ]
        : []),
      {
        seccion: "Resumen general",
        detalle: "Total ingresos del dia",
        valor: formatMoney(totalIncome),
      },
      {
        seccion: "Resumen general",
        detalle: "Neto total del dia",
        valor: formatMoney(totalNetDay),
      },
      {
        seccion: "Resumen general",
        detalle: "Monto para proximo turno",
        valor: formatMoney(nextShiftAmount),
      },
    ];

    sessionsSummary.forEach((session) => {
      rows.push(
        {
          seccion: session.label,
          detalle: "Ingreso efectivo",
          valor: formatMoney(session.cashIncome),
        },
        {
          seccion: session.label,
          detalle: "Ingreso transferencia",
          valor: formatMoney(session.transferIncome),
        },
        {
          seccion: session.label,
          detalle: "Ingresos manuales",
          valor: formatMoney(session.manualIncome),
        },
        {
          seccion: session.label,
          detalle: session.outflowLabel,
          valor: `-${formatMoney(session.withdrawalsOut)}`,
        },
        {
          seccion: session.label,
          detalle: "Compra con caja",
          valor: `-${formatMoney(session.purchasesWithCash)}`,
        },
        ...(session.unclassifiedOutflow > 0
          ? [
              {
                seccion: session.label,
                detalle: "Retiros/compras no clasificados",
                valor: `-${formatMoney(session.unclassifiedOutflow)}`,
              },
            ]
          : []),
        {
          seccion: session.label,
          detalle: "Total ingresos sesion",
          valor: formatMoney(session.sessionIncomeTotal),
        },
        {
          seccion: session.label,
          detalle: "Neto sesion",
          valor: formatMoney(session.sessionNetTotal),
        }
      );
    });

    exportRowsToPdf({
      filename: `reporte-caja-dia-${dailyPayload.date}`,
      title: `Reporte Diario de Caja (${dailyPayload.date})`,
      subtitle: "Resumen por sesiones y total consolidado del dia.",
      columns: [
        { key: "seccion", label: "Seccion" },
        { key: "detalle", label: "Detalle" },
        { key: "valor", label: "Valor" },
      ],
      rows,
    });
  }, [dailyGrossIncomeTotal, dailyPayload, nextShiftAmount, selectedDaySummary, sessionSummaries]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Cajas del mes
              </CardTitle>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setVisibleMonth((prev) => subMonths(prev, 1))}
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Badge variant="secondary" className="text-xs">
                {format(visibleMonth, "MMMM yyyy", { locale: es })}
              </Badge>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setVisibleMonth((prev) => addMonths(prev, 1))}
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                Diferencia del mes
              </p>
              <p
                className={`text-2xl font-bold ${
                  Number(selectedMonth.difference ?? 0) < 0
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
              >
                {formatMoney(Number(selectedMonth.difference ?? 0), 0)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Promedio:{" "}
                {formatMoney(
                  Number(selectedMonth.source.avgDifference ?? 0),
                  0
                )}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Ingresos</p>
              <p className="text-2xl font-bold">
                {formatMoney(
                  Number(selectedMonth.salesTotal ?? 0),
                  0
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Efectivo: {formatMoney(selectedMonth.cashSales, 0)} /
                Transferencias:{" "}
                {formatMoney(selectedMonth.transferSales, 0)}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isMonthlyLoading && (
            <BrandSpinner
              size="sm"
              label="Cargando consolidado mensual..."
              layout="inline"
            />
          )}

          {!isMonthlyLoading && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {!isMonthlyLoading && !error && (
            <div className="space-y-6">
              <div className="h-[280px] sm:h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData}>
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickFormatter={(val) => formatMonthValue(val, "MMM yy")}
                    />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                      formatter={(value: number) =>
                        formatMoney(Number(value ?? 0), 0)
                      }
                    />
                    <Legend iconType="circle" />
                    <Bar
                      dataKey="esperado"
                      fill="hsl(var(--primary))"
                      name="Esperado"
                      radius={[4, 4, 0, 0]}
                      barSize={20}
                    />
                    <Bar
                      dataKey="contado"
                      fill="#22c55e"
                      name="Contado"
                      radius={[4, 4, 0, 0]}
                      barSize={20}
                    />
                    <Bar
                      dataKey="diferencia"
                      fill="#ef4444"
                      name="Diferencia"
                      radius={[4, 4, 0, 0]}
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Details Table */}
              <div className="hidden overflow-hidden rounded-xl border bg-muted/20 md:block">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Mes</th>
                      <th className="px-4 py-3 text-right">Efectivo</th>
                      <th className="px-4 py-3 text-right">Transf.</th>
                      <th className="px-4 py-3 text-right">Total ventas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-background">
                    {monthlyItems.map((item) => {
                      const monthKey = item.month ?? item.label ?? item.key;

                      return (
                        <tr
                          key={monthKey}
                          className={
                            monthKey === selectedMonthKey
                              ? "bg-primary/5 font-semibold"
                              : "hover:bg-muted/30"
                          }
                        >
                          <td className="px-4 py-3 uppercase">
                            {formatMonthValue(monthKey, "MMMM yyyy")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatMoney(item.cashSales, 0)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatMoney(item.transferSales, 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatMoney(Number(item.salesTotal ?? 0), 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" />
            Libro diario ({selectedDateYmd})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="date"
              value={selectedDateYmd}
              onChange={(event) =>
                setSelectedDate(new Date(`${event.target.value}T00:00:00`))
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDaily()}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Recargar dia
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportDailyPdf}
              disabled={!dailyPayload}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF del dia
            </Button>
          </div>

          {isDailyLoading && (
            <BrandSpinner
              size="sm"
              label="Cargando libro diario..."
              layout="inline"
            />
          )}

          {!isDailyLoading && dailyPayload && (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Daily Progress Section */}
              <div className="space-y-6 lg:col-span-8">
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
                    <Clock className="h-4 w-4" />
                    Sesiones del día
                  </h3>
                  <div className="grid gap-4">
                    {sessionSummaries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center bg-muted/20">
                        <History className="mb-3 h-10 w-10 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground font-medium">
                          No hay sesiones registradas para esta fecha.
                        </p>
                      </div>
                    ) : (
                      sessionSummaries.map(({ row, session }) => {
                        const cashIncome = Number(row.cashSales ?? 0);
                        const transferIncome = Number(row.transferSales ?? 0);
                        const manualIncome = Number(row.manualIncome ?? 0);
                        const purchasesWithCash = Number(row.cashPurchases ?? 0);
                        const withdrawalsOut = Number(row.withdrawalsNet ?? 0);
                        const sessionIncomeTotal =
                          Number(row.salesTotal ?? 0) + manualIncome;
                        const projectedOperational = Number(
                          row.expectedCash ?? session?.expectedCash ?? 0
                        );
                        const countedOperational =
                          (row.countedCash ?? null) !== null ||
                          session?.status === "CLOSED"
                            ? Number(row.countedCash ?? session?.countedCash ?? 0)
                            : null;
                        const differenceOperational =
                          (row.difference ?? null) !== null ||
                          session?.status === "CLOSED"
                            ? Number(row.difference ?? session?.difference ?? 0)
                            : 0;
                        const sessionStatus =
                          String(
                            (row.source.status as string | undefined) ??
                              session?.status ??
                              "CLOSED"
                          ).toUpperCase() === "OPEN"
                            ? "OPEN"
                            : "CLOSED";
                        const openedAt =
                          (row.source.openedAt as string | undefined) ??
                          session?.openedAt ??
                          null;
                        const closedAt =
                          (row.source.closedAt as string | undefined) ??
                          session?.closedAt ??
                          null;
                        const openingFloat = Number(
                          (row.source.openingFloat as number | undefined) ??
                            session?.openingFloat ??
                            0
                        );
                        const salesCount = Number(session?.salesCount ?? 0);

                        return (
                          <div
                            key={row.sessionId ?? row.key}
                            className="group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md"
                          >
                            <div
                              className={`absolute left-0 top-0 h-full w-1.5 ${
                                sessionStatus === "OPEN"
                                  ? "bg-emerald-500"
                                  : "bg-blue-600"
                              }`}
                            />
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    className={
                                      sessionStatus === "OPEN"
                                        ? "bg-emerald-500 hover:bg-emerald-600"
                                        : "bg-blue-600 hover:bg-blue-700"
                                    }
                                  >
                                    {sessionStatus === "OPEN"
                                      ? "ABIERTA"
                                      : "CERRADA"}
                                  </Badge>
                                </div>
                                <div className="text-lg font-bold tracking-tight">
                                  {openedAt
                                    ? format(new Date(openedAt), "HH:mm", {
                                        locale: es,
                                      })
                                    : "--:--"}{" "}
                                  <span className="mx-1 text-muted-foreground/50">
                                    →
                                  </span>{" "}
                                  {closedAt
                                    ? format(new Date(closedAt), "HH:mm", {
                                        locale: es,
                                      })
                                    : "En curso"}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:gap-6">
                                <div className="text-right sm:border-r sm:pr-6">
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                    Apertura
                                  </p>
                                  <p className="text-sm font-semibold">
                                    {formatMoney(openingFloat, 0)}
                                  </p>
                                </div>
                                <div className="text-right sm:border-r sm:pr-6">
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                    Proyectado
                                  </p>
                                  <p className="text-sm font-semibold text-blue-600">
                                    {formatMoney(projectedOperational, 0)}
                                  </p>
                                </div>
                                {sessionStatus === "CLOSED" && (
                                  <>
                                    <div className="text-right sm:border-r sm:pr-6">
                                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                        Contado
                                      </p>
                                      <p className="text-sm font-semibold">
                                        {formatMoney(
                                          countedOperational ?? 0,
                                          0
                                        )}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                        Diferencia
                                      </p>
                                      <p
                                        className={`text-sm font-bold ${
                                          differenceOperational < 0
                                            ? "text-red-600"
                                            : differenceOperational > 0
                                            ? "text-emerald-600"
                                            : "text-blue-600"
                                        }`}
                                      >
                                        {formatMoney(differenceOperational, 0)}
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
                                <Ticket className="h-3.5 w-3.5" />
                                {salesCount} Ventas
                              </span>
                            </div>

                            <div className="mt-3 grid gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                              <div className="rounded-md border bg-background p-2">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  Ingreso efectivo
                                </p>
                                <p className="font-bold text-emerald-600">
                                  {formatMoney(cashIncome, 0)}
                                </p>
                              </div>
                              <div className="rounded-md border bg-background p-2">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  Ingreso transferencia
                                </p>
                                <p className="font-bold text-sky-600">
                                  {formatMoney(transferIncome, 0)}
                                </p>
                              </div>
                              <div className="rounded-md border bg-background p-2">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  Ingresos manuales
                                </p>
                                <p className="font-bold text-emerald-600">
                                  {formatMoney(manualIncome, 0)}
                                </p>
                              </div>
                              <div className="rounded-md border bg-background p-2">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  Retiro de caja
                                </p>
                                <p className="font-bold text-red-600">
                                  {formatMoney(withdrawalsOut, 0)}
                                </p>
                              </div>
                              <div className="rounded-md border bg-background p-2">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  Compra con caja
                                </p>
                                <p className="font-bold text-amber-600">
                                  {formatMoney(purchasesWithCash, 0)}
                                </p>
                              </div>
                              {(row.unclassifiedOutflow ?? 0) > 0 ? (
                                <div className="rounded-md border bg-background p-2">
                                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                    Retiros/compras no clasificados
                                  </p>
                                  <p className="font-bold text-orange-600">
                                    {formatMoney(row.unclassifiedOutflow ?? 0, 0)}
                                  </p>
                                </div>
                              ) : null}
                              <div className="rounded-md border bg-background p-2">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  Ventas Totales
                                </p>
                                <p className="font-bold text-foreground">
                                  {formatMoney(sessionIncomeTotal, 0)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
                    <History className="h-4 w-4" />
                    Últimos movimientos
                  </h3>
                  <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="divide-y divide-muted/50">
                      {dailyPayload.entries.length === 0 ? (
                        <div className="py-12 text-center italic text-muted-foreground">
                          No hay movimientos detallados.
                        </div>
                      ) : (
                        dailyPayload.entries
                          .slice(0, DAILY_MOVEMENTS_LIMIT)
                          .map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-4 transition-colors hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-4">
                                <div
                                  className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${
                                    entry.direction === "IN"
                                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                      : "bg-red-50 text-red-600 border border-red-100"
                                  }`}
                                >
                                  {entry.direction === "IN" ? (
                                    <span className="text-lg font-bold">↓</span>
                                  ) : (
                                    <span className="text-lg font-bold">↑</span>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">
                                    {getEntryLabel(entry)}
                                  </p>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="font-medium">
                                      {entry.createdAt
                                        ? format(
                                            new Date(entry.createdAt),
                                            "HH:mm",
                                            { locale: es }
                                          )
                                        : "--:--"}
                                    </span>
                                    <span>•</span>
                                    <span className="uppercase tracking-wider">
                                      {getEntryMethodLabel(entry.method)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`text-base font-black ${
                                    entry.direction === "IN"
                                      ? "text-emerald-600"
                                      : "text-red-500"
                                  }`}
                                >
                                  {entry.direction === "IN" ? "+" : "-"}
                                  {formatMoney(entry.amount)}
                                </p>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Stats Sidebar */}
              <div className="space-y-6 lg:col-span-4">
                <div className="rounded-2xl border bg-gradient-to-br from-background via-muted/20 to-muted/40 p-5 shadow-sm space-y-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    Resumen Consolidado
                    <Badge
                      variant="outline"
                      className="bg-background font-mono"
                    >
                      {selectedDaySummary.date ?? selectedDateYmd}
                    </Badge>
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                        Total Ingresos
                        <span className="text-emerald-600">
                          {formatMoney(dailyGrossIncomeTotal)}
                        </span>
                      </p>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Efectivo</span>
                        <span className="font-semibold text-foreground">
                          {formatMoney(cashIncomeTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-dashed pb-2">
                        <span className="text-muted-foreground">
                          Transferencias
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatMoney(transferIncomeTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">
                          Movimientos de ingreso
                        </span>
                        <span className="text-emerald-600 font-bold">
                          +{formatMoney(manualIncomeTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-dashed pb-2">
                        <span className="text-muted-foreground font-medium">
                          Retiros de caja
                        </span>
                        <span className="text-red-600 font-bold">
                          {formatMoney(withdrawalsTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-dashed pb-2">
                        <span className="text-muted-foreground font-medium">
                          Compras con caja
                        </span>
                        <span className="font-bold text-amber-600">
                          {formatMoney(cashPurchasesTotal)}
                        </span>
                      </div>
                      {(selectedDaySummary.unclassifiedOutflow ?? 0) > 0 ? (
                        <div className="flex justify-between items-center text-sm border-b border-dashed pb-2">
                          <span className="text-muted-foreground font-medium">
                            Retiros/compras no clasificados
                          </span>
                          <span className="font-bold text-orange-600">
                            {formatMoney(selectedDaySummary.unclassifiedOutflow ?? 0)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border bg-background px-4 py-5">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">
                              Resultado total de ingresos
                            </p>
                            <p
                              className={`text-3xl font-bold tracking-tight ${
                                dailyGrossIncomeTotal >= 0
                                  ? "text-foreground"
                                  : "text-red-600"
                              }`}
                            >
                              {formatMoney(dailyGrossIncomeTotal)}
                            </p>
                          </div>
                          <Info className="mt-1 h-4 w-4 text-muted-foreground/40" />
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Efectivo {formatMoney(cashIncomeTotal)} ·
                          Transferencias {formatMoney(transferIncomeTotal)}
                          {/* Ingresos {formatMoney(manualIncomeTotal)} */}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* <div className="rounded-2xl border bg-card p-6 shadow-sm border-primary/10">
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Balance de Cierre
                      </p>
                      <p
                        className={`text-4xl font-black tracking-tighter ${
                          (dailyPayload.summary.difference ?? 0) < 0
                            ? "text-red-600"
                            : (dailyPayload.summary.difference ?? 0) === 0
                            ? "text-blue-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {formatMoney(dailyPayload.summary.difference ?? 0)}
                      </p>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Diferencia total acumulada
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/30 p-3 text-center border">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">
                          Total Contado
                        </p>
                        <p className="text-sm font-black">
                          {formatMoney(
                            dailyPayload.summary.countedCash ?? 0,
                            0
                          )}
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/30 p-3 text-center border">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">
                          Total Esperado
                        </p>
                        <p className="text-sm font-black">
                          {formatMoney(
                            dailyPayload.summary.expectedCash ?? 0,
                            0
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-center">
                      <p className="text-[9px] font-bold text-emerald-700 uppercase mb-1">
                        Monto para proximo turno
                      </p>
                      <p className="text-base font-black text-emerald-700">
                        {formatMoney(nextShiftAmount, 0)}
                      </p>
                      <p className="text-[10px] text-emerald-700">
                        {latestClosedSession?.closedAt
                          ? `Ultimo cierre: ${new Date(
                              latestClosedSession.closedAt
                            ).toLocaleString("es-AR")}`
                          : "Tomado del cierre diario consolidado"}
                      </p>
                    </div>

                    <div className="pt-2">
                      <div className="rounded-lg bg-blue-50 p-3 border border-blue-100 flex gap-3 items-center">
                        <Info className="h-4 w-4 text-blue-600 shrink-0" />
                        <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                          Este resumen consolida {dailyPayload.sessions.length}{" "}
                          sesiones del día {dailyPayload.date}.
                        </p>
                      </div>
                    </div>
                  </div>
                </div> */}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
