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
  RefreshCcw,
  Wallet,
} from "lucide-react";

import { backendApi } from "@/lib/backend-api";
import { useUser } from "@/components/providers/user-provider";
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
    entries: {
      items: [],
      meta: {
        total: 0,
        offset: 0,
        limit: 30,
        hasMore: false,
      },
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
              {/* <p className="text-sm text-muted-foreground">
                Consolidado desde /reporting/cash/monthly y detalle diario desde
                /cash/book/daily.
              </p> */}
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
                className={`text-2xl font-bold ${
                  selectedMonth.difference < 0
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
            <div className="h-[280px] sm:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip
                    formatter={(value: number) =>
                      formatMoney(Number(value ?? 0))
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="esperado"
                    fill="#3b82f6"
                    name="Esperado"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="contado"
                    fill="#22c55e"
                    name="Contado"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="diferencia"
                    fill="#f59e0b"
                    name="Diferencia"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
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
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
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
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Apertura</p>
                  <p className="text-base font-semibold">
                    {formatMoney(dailyPayload.summary.openingFloat)}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Esperado</p>
                  <p className="text-base font-semibold">
                    {formatMoney(dailyPayload.summary.expectedCash)}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Contado</p>
                  <p className="text-base font-semibold">
                    {dailyPayload.summary.countedCash === null
                      ? "-"
                      : formatMoney(dailyPayload.summary.countedCash)}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Diferencia</p>
                  <p
                    className={`text-base font-semibold ${
                      Number(dailyPayload.summary.difference ?? 0) < 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {dailyPayload.summary.difference === null
                      ? "-"
                      : formatMoney(dailyPayload.summary.difference)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Ingresos efectivo
                  </p>
                  <p className="text-base font-semibold">
                    {formatMoney(dailyPayload.summary.income.cashFromPayments)}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Transferencias
                  </p>
                  <p className="text-base font-semibold">
                    {formatMoney(
                      dailyPayload.summary.income.transferFromPayments
                    )}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Ingresos manuales
                  </p>
                  <p className="text-base font-semibold">
                    {formatMoney(dailyPayload.summary.income.movementIn)}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Egresos manuales
                  </p>
                  <p className="text-base font-semibold">
                    {formatMoney(dailyPayload.summary.outflow.movementOut)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {dailyPayload.entries.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay movimientos para este dia.
                  </p>
                ) : (
                  dailyPayload.entries.items.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid gap-2 rounded-md border p-3 text-xs sm:grid-cols-5"
                    >
                      <div>
                        <p className="text-muted-foreground">Tipo</p>
                        <p className="font-medium">{entry.type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monto</p>
                        <p className="font-medium">
                          {formatMoney(entry.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Metodo</p>
                        <p className="font-medium">{entry.method ?? "-"}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">Descripcion</p>
                        <p className="font-medium">
                          {entry.description ?? "-"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
