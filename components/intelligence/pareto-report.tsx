"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import type { CIParetoMetric, CIPriceType } from "@/lib/api-types";

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
function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

const METRIC_LABELS: Record<CIParetoMetric, string> = {
  REVENUE: "Ingresos",
  PROFIT: "Ganancia",
  UNITS: "Unidades",
};

const PRICE_TYPE_LABELS: Record<CIPriceType, string> = {
  ALL: "Todos",
  RETAIL: "Minorista",
  WHOLESALE: "Mayorista",
};

export function ParetoReport() {
  const { branchId } = useUser();
  const [metric, setMetric] = useState<CIParetoMetric>("REVENUE");
  const [priceType, setPriceType] = useState<CIPriceType>("ALL");

  const { data, isLoading, error } = useSWR(
    branchId ? ["ci-pareto", branchId, metric, priceType] : null,
    () => backendApi.commercialIntelligence.pareto({ metric, priceType, cutoff: 80, limit: 100 }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const chartData = (data?.data ?? []).slice(0, 50).map((item) => ({
    name: item.name.length > 20 ? item.name.slice(0, 18) + "…" : item.name,
    fullName: item.name,
    value:
      metric === "REVENUE"
        ? item.totalRevenue
        : metric === "PROFIT"
        ? item.totalProfit
        : item.totalUnits,
    cumulative: item.cumulativePct,
    inSet: item.inParetoSet,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center">
                Análisis Pareto 80/20
                <InfoTip text="El principio 80/20 dice que aprox. el 20% de los productos genera el 80% de las ventas. Este reporte identifica esos productos estrella para que puedas priorizarlos en stock y promociones." />
              </CardTitle>
              <CardDescription>
                {data
                  ? `${data.summary.paretoProductCount} productos concentran el 80% de los ${METRIC_LABELS[metric].toLowerCase()} (${data.summary.paretoProductPct.toFixed(1)}% del catálogo)`
                  : "Top productos por contribución al negocio"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={metric} onValueChange={(v) => setMetric(v as CIParetoMetric)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["REVENUE", "PROFIT", "UNITS"] as CIParetoMetric[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {METRIC_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priceType} onValueChange={(v) => setPriceType(v as CIPriceType)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["ALL", "RETAIL", "WHOLESALE"] as CIPriceType[]).map((pt) => (
                    <SelectItem key={pt} value={pt}>
                      {PRICE_TYPE_LABELS[pt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-64 w-full" />}
          {error && (
            <div className="flex items-center gap-2 text-destructive py-8 justify-center">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Error al cargar datos</span>
            </div>
          )}
          {data && data.summary.dataQuality.fallbackCostWarning && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-2 mb-4 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {data.summary.dataQuality.productsWithFallbackCost} productos sin costo real — la ganancia puede estar subestimada.
            </div>
          )}
          {data && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) =>
                    metric === "UNITS" ? String(v) : `$${(v / 1000).toFixed(0)}k`
                  }
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11 }}
                />
                <RechartsTooltip
                  formatter={(value, name) => {
                    if (name === "cumulative") return [`${Number(value).toFixed(1)}%`, "% acumulado"];
                    return metric === "UNITS"
                      ? [Number(value).toFixed(0), METRIC_LABELS[metric]]
                      : [fmt(Number(value)), METRIC_LABELS[metric]];
                  }}
                  labelFormatter={(label) => label}
                />
                <Legend formatter={(v) => (v === "value" ? METRIC_LABELS[metric] : "% acumulado")} />
                <Bar
                  yAxisId="left"
                  dataKey="value"
                  name="value"
                  fill="#2563eb"
                  opacity={0.85}
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative"
                  name="cumulative"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
                <ReferenceLine yAxisId="right" y={80} stroke="#ef4444" strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {data && data.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalle de Productos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground w-10">#</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Producto</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Unidades</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Ingresos</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Ganancia</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Margen</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">% del total</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        % acum.
                        <InfoTip text="Porcentaje acumulado: cuánto del total representan este producto más todos los que aparecen antes en la lista." />
                      </span>
                    </th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        Pareto
                        <InfoTip text='★ Estrella: top 10 productos con mayor impacto. "80%": resto del grupo que genera el 80% de las ventas. "Cola": menor impacto.' />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((item) => (
                    <tr key={item.productId} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground">{item.rank}</td>
                      <td className="px-4 py-2 font-medium max-w-48">
                        <div className="truncate" title={item.name}>{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </td>
                      <td className="px-4 py-2 text-right">{item.totalUnits.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right">{fmt(item.totalRevenue)}</td>
                      <td className="px-4 py-2 text-right">{fmt(item.totalProfit)}</td>
                      <td className="px-4 py-2 text-right">
                        {item.profitMarginPct !== null ? fmtPct(item.profitMarginPct) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">{fmtPct(item.pctOfTotal)}</td>
                      <td className="px-4 py-2 text-right">{fmtPct(item.cumulativePct)}</td>
                      <td className="px-4 py-2 text-center">
                        {item.rank <= 10 ? (
                          <Badge variant="default" className="bg-amber-500 text-xs">
                            ★ Estrella
                          </Badge>
                        ) : item.inParetoSet ? (
                          <Badge variant="default" className="bg-blue-600 text-xs">
                            80%
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            cola
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
