"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
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
  History,
  Info,
  RefreshCcw,
  Ticket,
  Users,
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

import type {
  CashBookDailyResponse,
  ReportsCashMonthlyItem,
  ReportsCashMonthlyResponse,
} from "@/lib/api-types";

function formatMoney(value: number, maximumFractionDigits = 2) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits,
  });
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

export function CashCalendarReport() {
  const { branchId } = useUser();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [monthlyPayload, setMonthlyPayload] =
    useState<ReportsCashMonthlyResponse | null>(null);
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
      setMonthlyPayload(null);
      setError("No hay sucursal activa para consultar cajas.");
      return;
    }

    const fromMonth = format(subMonths(visibleMonth, 5), "yyyy-MM");
    const toMonth = format(visibleMonth, "yyyy-MM");

    try {
      setIsMonthlyLoading(true);
      setError(null);

      const payload = await backendApi.reporting.cash.monthly(
        {
          branchId,
          fromMonth,
          toMonth,
        },
        branchId,
        undefined
      );

      setMonthlyPayload(payload);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudo cargar el reporte mensual de cajas.";
      setError(message);
      setMonthlyPayload(null);
    } finally {
      setIsMonthlyLoading(false);
    }
  }, [branchId, visibleMonth]);

  const loadDaily = useCallback(async () => {
    if (!branchId) {
      setDailyPayload(emptyDailyResponse(selectedDateYmd));
      setError("No hay sucursal activa para consultar caja diaria.");
      return;
    }

    try {
      setIsDailyLoading(true);
      setError(null);

      const payload = await backendApi.cash.dailyBook(
        { date: selectedDateYmd },
        branchId
      );

      setDailyPayload(payload);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudo cargar el libro diario de caja.";
      setError(message);
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
      (monthlyPayload?.items ?? [])
        .slice()
        .sort((a, b) => a.month.localeCompare(b.month)),
    [monthlyPayload?.items]
  );

  const selectedMonthKey = format(visibleMonth, "yyyy-MM");
  const selectedMonth = useMemo(
    () =>
      monthlyItems.find((item) => item.month === selectedMonthKey) ??
      ({
        month: selectedMonthKey,
        openingFloatTotal: 0,
        cashFromSales: 0,
        transferFromSales: 0,
        manualIn: 0,
        manualOut: 0,
        expectedCashClose: 0,
        countedCashClose: 0,
        difference: 0,
        sessionsCount: 0,
        daysWithClose: 0,
        avgDifference: 0,
      } satisfies ReportsCashMonthlyItem),
    [monthlyItems, selectedMonthKey]
  );

  const monthlyChartData = useMemo(
    () =>
      monthlyItems.map((item) => ({
        month: item.month,
        esperado: Number(item.expectedCashClose ?? 0),
        contado: Number(item.countedCashClose ?? 0),
        diferencia: Number(item.difference ?? 0),
      })),
    [monthlyItems]
  );

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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void loadMonthly();
                  void loadDaily();
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                Esperado de cierre
              </p>
              <p className="text-2xl font-bold">
                {formatMoney(selectedMonth.expectedCashClose, 0)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Contado: {formatMoney(selectedMonth.countedCashClose, 0)}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                Diferencia del mes
              </p>
              <p
                className={`text-2xl font-bold ${selectedMonth.difference < 0
                    ? "text-red-600"
                    : "text-emerald-600"
                  }`}
              >
                {formatMoney(selectedMonth.difference, 0)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Promedio: {formatMoney(selectedMonth.avgDifference, 0)}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Ingresos</p>
              <p className="text-2xl font-bold">
                {formatMoney(
                  Number(selectedMonth.cashFromSales ?? 0) +
                  Number(selectedMonth.transferFromSales ?? 0),
                  0
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Efectivo: {formatMoney(selectedMonth.cashFromSales, 0)} /
                Transferencias:{" "}
                {formatMoney(selectedMonth.transferFromSales, 0)}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Sesiones cerradas</p>
              <p className="text-2xl font-bold">
                {selectedMonth.daysWithClose}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Total sesiones: {selectedMonth.sessionsCount}
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
                      tickFormatter={(val) => format(new Date(val + "-01T12:00:00"), "MMM yy", { locale: es })}
                    />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => formatMoney(Number(value ?? 0), 0)}
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
                      <th className="px-4 py-3 text-right">Ing/Eg. Man.</th>
                      <th className="px-4 py-3 text-right">Esperado</th>
                      <th className="px-4 py-3 text-right">Diferencia</th>
                      <th className="px-4 py-3 text-center">Sesiones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-background">
                    {monthlyItems.map((item) => (
                      <tr key={item.month} className={item.month === selectedMonthKey ? "bg-primary/5 font-semibold" : "hover:bg-muted/30"}>
                        <td className="px-4 py-3 uppercase">
                          {format(new Date(item.month + "-01T12:00:00"), "MMMM yyyy", { locale: es })}
                        </td>
                        <td className="px-4 py-3 text-right">{formatMoney(item.cashFromSales, 0)}</td>
                        <td className="px-4 py-3 text-right">{formatMoney(item.transferFromSales, 0)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-emerald-600">+{formatMoney(item.manualIn, 0)}</span> / <span className="text-red-600">-{formatMoney(item.manualOut, 0)}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{formatMoney(item.expectedCashClose, 0)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${item.difference < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {formatMoney(item.difference, 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="text-[10px] h-5">
                            {item.daysWithClose}/{item.sessionsCount}
                          </Badge>
                        </td>
                      </tr>
                    ))}
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
                    {dailyPayload?.sessions?.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center bg-muted/20">
                        <History className="mb-3 h-10 w-10 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground font-medium">
                          No hay sesiones registradas para esta fecha.
                        </p>
                      </div>
                    ) : (
                      dailyPayload.sessions.map((session) => (
                        <div
                          key={session.id}
                          className="group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md"
                        >
                          <div
                            className={`absolute left-0 top-0 h-full w-1.5 ${session.status === "OPEN"
                                ? "bg-emerald-500"
                                : "bg-blue-600"
                              }`}
                          />
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={
                                    session.status === "OPEN"
                                      ? "bg-emerald-500 hover:bg-emerald-600"
                                      : "bg-blue-600 hover:bg-blue-700"
                                  }
                                >
                                  {session.status === "OPEN"
                                    ? "ABIERTA"
                                    : "CERRADA"}
                                </Badge>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {session.id.slice(0, 8)}
                                </span>
                              </div>
                              <div className="text-lg font-bold tracking-tight">
                                {format(new Date(session.openedAt!), "HH:mm", {
                                  locale: es,
                                })}{" "}
                                <span className="mx-1 text-muted-foreground/50">
                                  →
                                </span>{" "}
                                {session.closedAt
                                  ? format(new Date(session.closedAt), "HH:mm", {
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
                                  {formatMoney(session.openingFloat, 0)}
                                </p>
                              </div>
                              <div className="text-right sm:border-r sm:pr-6">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                  Proyectado
                                </p>
                                <p className="text-sm font-semibold text-blue-600">
                                  {formatMoney(session.expectedCash ?? 0, 0)}
                                </p>
                              </div>
                              {session.status === "CLOSED" && (
                                <>
                                  <div className="text-right sm:border-r sm:pr-6">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                      Contado
                                    </p>
                                    <p className="text-sm font-semibold">
                                      {formatMoney(session.countedCash ?? 0, 0)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                      Diferencia
                                    </p>
                                    <p
                                      className={`text-sm font-bold ${(session.difference ?? 0) < 0
                                          ? "text-red-600"
                                          : (session.difference ?? 0) > 0
                                            ? "text-emerald-600"
                                            : "text-blue-600"
                                        }`}
                                    >
                                      {formatMoney(session.difference ?? 0, 0)}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
                              <Ticket className="h-3.5 w-3.5" />
                              {session.salesCount} Ventas
                            </span>
                            <span className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
                              <Users className="h-3.5 w-3.5" />
                              ID Usuario:{" "}
                              {session.openedByUserId?.slice(0, 8) ?? "N/A"}
                            </span>
                          </div>
                        </div>
                      ))
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
                        dailyPayload.entries.slice(0, 20).map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between p-4 transition-colors hover:bg-muted/30"
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${entry.direction === "IN"
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
                                  {entry.sourceType === "SALE_PAYMENT"
                                    ? "Venta #" + entry.id.slice(0, 6)
                                    : entry.notes || "Movimiento de caja"}
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
                                    {entry.method === "CASH"
                                      ? "Efectivo"
                                      : entry.method === "TRANSFER"
                                        ? "Transferencia"
                                        : entry.method || "Otro"}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-base font-black ${entry.direction === "IN"
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
                    <Badge variant="outline" className="bg-background font-mono">
                      {dailyPayload.date}
                    </Badge>
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                        Total Ingresos
                        <span className="text-emerald-600">{formatMoney(dailyPayload.summary.income.cashFromPayments + dailyPayload.summary.income.movementIn)}</span>
                      </p>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Apertura Inicial</span>
                        <span className="font-bold">{formatMoney(dailyPayload.summary.openingFloat)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-dashed pb-2">
                        <span className="text-muted-foreground">Ventas (Efectivo)</span>
                        <span className="font-semibold text-foreground">{formatMoney(dailyPayload.summary.income.cashFromPayments)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Entradas Extras</span>
                        <span className="text-emerald-600 font-bold">+{formatMoney(dailyPayload.summary.income.movementIn)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-dashed pb-2">
                        <span className="text-muted-foreground font-medium">Salidas Extras</span>
                        <span className="text-red-600 font-bold">-{formatMoney(dailyPayload.summary.outflow.movementOut)}</span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-background border p-4 shadow-inner">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Resultado Diario (Neto)</p>
                          <p className={`text-2xl font-black ${dailyPayload.summary.income.cashFromPayments + dailyPayload.summary.income.transferFromPayments + dailyPayload.summary.income.movementIn - dailyPayload.summary.outflow.movementOut >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {formatMoney(dailyPayload.summary.income.cashFromPayments + dailyPayload.summary.income.transferFromPayments + dailyPayload.summary.income.movementIn - dailyPayload.summary.outflow.movementOut)}
                          </p>
                        </div>
                        <Info className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-6 shadow-sm border-primary/10">
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Balance de Cierre</p>
                      <p className={`text-4xl font-black tracking-tighter ${(dailyPayload.summary.difference ?? 0) < 0 ? "text-red-600" : (dailyPayload.summary.difference ?? 0) === 0 ? "text-blue-600" : "text-emerald-600"
                        }`}>
                        {formatMoney(dailyPayload.summary.difference ?? 0)}
                      </p>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Diferencia total acumulada
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/30 p-3 text-center border">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Total Contado</p>
                        <p className="text-sm font-black">{formatMoney(dailyPayload.summary.countedCash ?? 0, 0)}</p>
                      </div>
                      <div className="rounded-xl bg-muted/30 p-3 text-center border">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Total Esperado</p>
                        <p className="text-sm font-black">{formatMoney(dailyPayload.summary.expectedCash ?? 0, 0)}</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="rounded-lg bg-blue-50 p-3 border border-blue-100 flex gap-3 items-center">
                        <Info className="h-4 w-4 text-blue-600 shrink-0" />
                        <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                          Este resumen consolida {dailyPayload.sessions.length} sesiones del día {dailyPayload.date}.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
