"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import useSWR from "swr";

import { useUser } from "@/components/providers/user-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { backendApi } from "@/lib/backend-api";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";
import type {
  ExpenseCategory,
  ExpenseContext,
  SnapshotPeriod,
} from "@/lib/api-types";
import { subscribeExpensesSync } from "@/lib/expenses-live-sync";

const CATEGORY_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#14b8a6",
  "#84cc16",
  "#e11d48",
];

const EXPENSE_CATEGORY_OPTIONS: Array<{
  value: "ALL" | ExpenseCategory;
  label: string;
}> = [
  { value: "ALL", label: "Todas las categorias" },
  { value: "RENT", label: "Alquiler" },
  { value: "SERVICES", label: "Servicios" },
  { value: "SALARIES", label: "Sueldos" },
  { value: "SUPPLIES", label: "Insumos" },
  { value: "MARKETING", label: "Marketing" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
  { value: "TAXES", label: "Impuestos" },
  { value: "LUZ", label: "Luz" },
  { value: "DESCARTABLES", label: "Descartables" },
  { value: "LIMPIEZA", label: "Limpieza" },
  { value: "BOLSAS", label: "Bolsas" },
  { value: "DESINFECCION", label: "Desinfeccion" },
  { value: "NAFTA", label: "Nafta" },
  { value: "MONOTRIBUTO", label: "Monotributo" },
  { value: "VEHICULO_PARTICULAR", label: "Vehiculo particular" },
  { value: "OTHER", label: "Otros" },
];

const PERIOD_OPTIONS: Array<{ value: SnapshotPeriod; label: string }> = [
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
];

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

function formatPeriodLabel(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-");
    return `${month}/${year}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.split("-");
    return `${day}/${month}`;
  }
  return value;
}

function getTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function ExpensesProjectionReport() {
  const { branchId } = useUser();
  const lastSyncAtRef = useRef(0);

  const [from, setFrom] = useState(() =>
    format(startOfMonth(addMonths(new Date(), -5)), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [period, setPeriod] = useState<SnapshotPeriod>("monthly");
  const [context, setContext] = useState<"ALL" | ExpenseContext>("ALL");
  const [category, setCategory] = useState<"ALL" | ExpenseCategory>("ALL");

  const { data, isLoading, error, mutate } = useSWR(
    branchId
      ? [
          "reporting-expenses-history",
          branchId,
          period,
          from,
          to,
          context,
          category,
        ]
      : null,
    () =>
      backendApi.reporting.expenses.history(
        {
          period,
          from,
          to,
          context: context === "ALL" ? undefined : context,
          category: category === "ALL" ? undefined : category,
        },
        branchId ?? "",
      ),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 2_500,
    },
  );

  useEffect(() => {
    if (!branchId) return;

    return subscribeExpensesSync((payload) => {
      if (payload.branchId && payload.branchId !== branchId) return;
      const now = Date.now();
      if (now - lastSyncAtRef.current < 1_000) return;
      lastSyncAtRef.current = now;
      void mutate();
    });
  }, [branchId, mutate]);

  const evolutionData = useMemo(
    () =>
      (data?.evolution ?? []).map((row) => ({
        period: row.period,
        label: formatPeriodLabel(row.period),
        total: Number(row.total ?? 0),
      })),
    [data?.evolution],
  );

  const categoryData = useMemo(
    () =>
      (data?.byCategory ?? []).map((row) => ({
        name: row.category,
        total: Number(row.total ?? 0),
        sharePercent: Number(row.sharePercent ?? 0),
      })),
    [data?.byCategory],
  );

  const totals = useMemo(() => {
    const total = Number(data?.total ?? 0);
    const current = Number(evolutionData[evolutionData.length - 1]?.total ?? 0);
    const previous = Number(
      evolutionData[evolutionData.length - 2]?.total ?? 0,
    );
    const average =
      evolutionData.length > 0
        ? evolutionData.reduce((sum, row) => sum + row.total, 0) /
          evolutionData.length
        : 0;

    return {
      total,
      current,
      average,
      trendPct: getTrend(current, previous),
    };
  }, [data?.total, evolutionData]);

  const exportRows = useMemo(
    () =>
      evolutionData.map((row) => ({
        periodo: row.period,
        total: formatMoney(row.total),
      })),
    [evolutionData],
  );

  const exportColumns = [
    { key: "periodo", label: "Periodo" },
    { key: "total", label: "Total" },
  ];

  const handleExport = (formatType: "csv" | "pdf") => {
    const payload = {
      filename: "reporte-gastos-historico",
      title: "Reporte de Gastos",
      subtitle: `Historico real del ${from} al ${to}`,
      columns: exportColumns,
      rows: exportRows,
    };

    if (formatType === "csv") {
      exportRowsToCsv(payload);
      return;
    }

    exportRowsToPdf(payload);
  };

  if (!branchId) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Selecciona una sucursal activa para ver el historial de gastos.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => handleExport("csv")}
          disabled={exportRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => handleExport("pdf")}
          disabled={exportRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de gastos</CardTitle>
          <CardDescription>
            Evolucion real del gasto usando historial consolidado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as SnapshotPeriod)
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totals.total)}
            </div>
            <p className="text-xs text-muted-foreground">Rango seleccionado</p>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">
          Cargando historial real de gastos...
        </p>
      )}

      {!isLoading && error && (
        <p className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "No se pudo cargar el historial de gastos."}
        </p>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Evolucion real de gastos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] sm:h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evolutionData}>
                      <XAxis
                        dataKey="label"
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
                      <Bar
                        dataKey="total"
                        fill="#0ea5e9"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Distribucion por categoria</CardTitle>
                <CardDescription>
                  Desglose real del rango consultado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] sm:h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        dataKey="total"
                        nameKey="name"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={
                              CATEGORY_COLORS[index % CATEGORY_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          formatMoney(Number(value ?? 0))
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Desglose por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay categorias para el rango seleccionado.
                </p>
              ) : (
                <div className="space-y-2">
                  {categoryData.map((row) => (
                    <div
                      key={String(row.name)}
                      className="grid gap-2 rounded-md border p-3 text-xs sm:grid-cols-3"
                    >
                      <div>
                        <p className="text-muted-foreground">Categoria</p>
                        <p className="font-medium">{String(row.name)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium">{formatMoney(row.total)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Participacion</p>
                        <p className="font-medium">
                          {row.sharePercent.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
