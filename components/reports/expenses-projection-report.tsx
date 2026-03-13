"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { backendApi } from "@/lib/backend-api";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";
import type { ExpenseCategory, ExpenseContext } from "@/lib/api-types";
import { subscribeExpensesSync } from "@/lib/expenses-live-sync";

const CATEGORY_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#14b8a6", "#84cc16", "#e11d48"];

const EXPENSE_CONTEXT_OPTIONS: Array<{ value: "ALL" | ExpenseContext; label: string }> = [
  { value: "ALL", label: "Todos los contextos" },
  { value: "GENERAL", label: "General" },
  { value: "RETAIL", label: "Retail" },
  { value: "WHOLESALE", label: "Wholesale" },
];

const EXPENSE_CATEGORY_OPTIONS: Array<{ value: "ALL" | ExpenseCategory; label: string }> = [
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

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

export function ExpensesProjectionReport() {
  const { branchId } = useUser();
  const lastSyncAtRef = useRef(0);

  const [from, setFrom] = useState(() => format(startOfMonth(addMonths(new Date(), -5)), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [horizonMonths, setHorizonMonths] = useState<3 | 6>(3);
  const [context, setContext] = useState<"ALL" | ExpenseContext>("ALL");
  const [category, setCategory] = useState<"ALL" | ExpenseCategory>("ALL");

  const { data, isLoading, error, mutate } = useSWR(
    branchId
      ? [
          "reporting-expenses-projection",
          branchId,
          from,
          to,
          horizonMonths,
          context,
          category,
        ]
      : null,
    () =>
      backendApi.reporting.expenses.projection(
        {
          branchId,
          from,
          to,
          horizonMonths,
          context: context === "ALL" ? undefined : context,
          category: category === "ALL" ? undefined : category,
        },
        branchId
      ),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 2_500,
    }
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

  const monthlyProjectionData = useMemo(() => {
    const source = new Map<string, { month: string; historical: number; projected: number }>();

    (data?.historical ?? []).forEach((row) => {
      const month = row.month;
      source.set(month, {
        month,
        historical: Number(row.total ?? 0),
        projected: source.get(month)?.projected ?? 0,
      });
    });

    (data?.projected ?? []).forEach((row) => {
      const month = row.month;
      source.set(month, {
        month,
        historical: source.get(month)?.historical ?? 0,
        projected: Number(row.total ?? 0),
      });
    });

    return Array.from(source.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [data?.historical, data?.projected]);

  const categoryData = useMemo(() => {
    const projected = data?.byCategoryProjected ?? [];
    if (projected.length > 0) {
      return projected.map((row) => ({
        name: row.category,
        total: Number(row.total ?? 0),
        pct: Number(row.pct ?? 0),
      }));
    }

    return (data?.byCategoryHistorical ?? []).map((row) => ({
      name: row.category,
      total: Number(row.total ?? 0),
      pct: Number(row.pct ?? 0),
    }));
  }, [data?.byCategoryHistorical, data?.byCategoryProjected]);

  const totals = useMemo(() => {
    const historicalTotal = (data?.historical ?? []).reduce(
      (sum, row) => sum + Number(row.total ?? 0),
      0
    );
    const projectedTotal = (data?.projected ?? []).reduce(
      (sum, row) => sum + Number(row.total ?? 0),
      0
    );

    return {
      historicalTotal,
      projectedTotal,
      trendPct: Number(data?.trendPct ?? 0),
    };
  }, [data?.historical, data?.projected, data?.trendPct]);

  const exportRows = useMemo(
    () =>
      monthlyProjectionData.map((row) => ({
        mes: row.month,
        historico: formatMoney(row.historical),
        proyectado: formatMoney(row.projected),
      })),
    [monthlyProjectionData]
  );

  const exportColumns = [
    { key: "mes", label: "Mes" },
    { key: "historico", label: "Historico" },
    { key: "proyectado", label: "Proyectado" },
  ];

  const handleExport = (formatType: "csv" | "pdf") => {
    const payload = {
      filename: "reporte-gastos-proyeccion",
      title: "Reporte de Gastos - Proyeccion",
      subtitle: `Periodo ${from} a ${to} | Horizonte ${horizonMonths} meses`,
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
          Selecciona una sucursal activa para ver la proyeccion de gastos.
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
          <CardTitle>Filtros de proyeccion</CardTitle>
          <CardDescription>
            Endpoint: /reporting/expenses/projection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />

            <select
              value={String(horizonMonths)}
              onChange={(event) => setHorizonMonths(Number(event.target.value) as 3 | 6)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="3">Horizonte 3 meses</option>
              <option value="6">Horizonte 6 meses</option>
            </select>

            <select
              value={context}
              onChange={(event) => setContext(event.target.value as "ALL" | ExpenseContext)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {EXPENSE_CONTEXT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as "ALL" | ExpenseCategory)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.trendPct < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {totals.trendPct.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">Variacion estimada mensual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Historico total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totals.historicalTotal)}</div>
            <p className="text-xs text-muted-foreground">Rango seleccionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Proyeccion total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totals.projectedTotal)}</div>
            <p className="text-xs text-muted-foreground">Siguientes {horizonMonths} meses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categoryData.length}</div>
            <p className="text-xs text-muted-foreground">Con participacion en el periodo</p>
          </CardContent>
        </Card>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando proyeccion de gastos...</p>}

      {!isLoading && error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "No se pudo cargar la proyeccion de gastos."}
        </p>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Evolucion historica vs proyectada</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] sm:h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyProjectionData}>
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip formatter={(value: number) => formatMoney(Number(value ?? 0))} />
                      <Legend />
                      <Bar dataKey="historical" fill="#0ea5e9" name="Historico" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="projected" fill="#f59e0b" name="Proyectado" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Participacion por categoria</CardTitle>
                <CardDescription>Proyectada (o historica si no hay proyeccion)</CardDescription>
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
                          <Cell key={`${entry.name}-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatMoney(Number(value ?? 0))} />
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
                <p className="text-sm text-muted-foreground">No hay categorias para el rango seleccionado.</p>
              ) : (
                <div className="space-y-2">
                  {categoryData.map((row) => (
                    <div key={String(row.name)} className="grid gap-2 rounded-md border p-3 text-xs sm:grid-cols-3">
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
                        <p className="font-medium">{row.pct.toFixed(2)}%</p>
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
