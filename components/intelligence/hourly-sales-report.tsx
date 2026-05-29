"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import type { CIHourlySalesGroupBy } from "@/lib/api-types";

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors ml-1.5">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function HourlySalesReport() {
  const { branchId } = useUser();
  const [groupBy, setGroupBy] = useState<CIHourlySalesGroupBy>("HOUR_OF_DAY");

  const { data, isLoading, error } = useSWR(
    branchId ? ["ci-hourly", branchId, groupBy] : null,
    () => backendApi.commercialIntelligence.hourlySales({ groupBy }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const chartData = (data?.data ?? []).map((row) => ({
    label: row.label,
    revenue: row.avgRevenuePerDay,
    isPeak: row.isPeakHour,
    isDead: row.isDeadHour,
    tickets: row.ticketCount,
    avgTicket: row.avgTicket,
  }));

  function getBarColor(isPeak: boolean, isDead: boolean) {
    if (isPeak) return "#16a34a";
    if (isDead) return "#dc2626";
    return "#2563eb";
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center">
              Ventas por Hora
              <InfoTip text="Muestra en qué horarios del día se concentran las ventas. Verde = hora pico (muchas ventas), Rojo = hora muerta (pocas ventas). Útil para saber cuándo hay más movimiento en tu negocio." />
            </CardTitle>
            <CardDescription>
              {data
                ? `${data.summary.totalDays} días analizados — Ingreso diario promedio: ${fmt(data.summary.avgDailyRevenue)}`
                : "Distribución de ventas por franja horaria"}
            </CardDescription>
          </div>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as CIHourlySalesGroupBy)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOUR_OF_DAY">Por hora del día</SelectItem>
              <SelectItem value="DAY_OF_WEEK_X_HOUR">Día × hora</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-72 w-full" />}
        {error && (
          <div className="flex items-center gap-2 text-destructive py-8 justify-center">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Error al cargar datos</span>
          </div>
        )}
        {data && chartData.length > 0 && (
          <>
            <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-green-600" /> Hora pico
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-600" /> Normal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-red-600" /> Hora muerta
              </span>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, bottom: 40, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  angle={groupBy === "DAY_OF_WEEK_X_HOUR" ? -60 : 0}
                  textAnchor={groupBy === "DAY_OF_WEEK_X_HOUR" ? "end" : "middle"}
                  interval={groupBy === "DAY_OF_WEEK_X_HOUR" ? 0 : "preserveStartEnd"}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                />
                <RechartsTooltip
                  formatter={(value, name) => [fmt(Number(value)), "Promedio diario"]}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    if (!row) return label;
                    return `${label} — ${row.tickets} transacciones — ticket medio: ${fmt(row.avgTicket)}`;
                  }}
                />
                <Bar dataKey="revenue" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={getBarColor(entry.isPeak, entry.isDead)}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {data.summary.peakHours.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Horas pico:{" "}
                {data.summary.peakHours
                  .map((h) => `${String(h).padStart(2, "0")}:00`)
                  .join(", ")}
                {data.summary.deadHours.length > 0 && (
                  <>
                    {" "}&bull; Horas muertas:{" "}
                    {data.summary.deadHours
                      .map((h) => `${String(h).padStart(2, "0")}:00`)
                      .join(", ")}
                  </>
                )}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
