"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  BarChart,
} from "recharts";
import { useUser } from "@/components/providers/user-provider";
import {
  getSalesAnalysisConfig,
  type SalesAnalysisPeriod,
} from "@/lib/reports/sales-trends";
import {
  formatReportingPeriodLabel,
  fetchReportingSalesSeries,
} from "@/lib/reports/reporting-sales-history";

interface SalesChartProps {
  period: SalesAnalysisPeriod;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

const chartConfig = {
  ventas: {
    label: "Ventas ($)",
    color: "hsl(var(--chart-1))",
  },
  pedidos: {
    label: "Pedidos",
    color: "hsl(var(--chart-2))",
  },
};

export function SalesChart({ period, dateRange }: SalesChartProps) {
  const { branchId } = useUser();
  const config = useMemo(() => getSalesAnalysisConfig(period), [period]);
  const current = dateRange ?? config.current;
  const groupBy = dateRange ? ("day" as const) : config.groupBy;
  const evolutionTitle = dateRange
    ? "Evolucion del Periodo"
    : config.evolutionTitle;
  const revenueDescription = dateRange
    ? "Tendencia de ingresos por dia del periodo seleccionado"
    : config.revenueDescription;
  const volumeDescription = dateRange
    ? "Volumen de operaciones por dia del periodo seleccionado"
    : config.volumeDescription;
  const { data, isLoading } = useSWR(
    branchId
      ? [
          "reporting-sales-chart",
          branchId,
          period,
          dateRange ? "custom" : "default",
          current.from.toISOString(),
          current.to.toISOString(),
          groupBy,
        ]
      : null,
    () => fetchReportingSalesSeries(current, groupBy, ["revenue", "count"]),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const chartData = useMemo(() => {
    const revenuePoints = data?.revenue.points ?? [];
    const countByPeriod = new Map(
      (data?.count.points ?? []).map((point) => [point.period, point.value])
    );

    return revenuePoints.map((point) => {
      return {
        name: formatReportingPeriodLabel(point.period, groupBy),
        ventas: point.value,
        pedidos: Number(countByPeriod.get(point.period) ?? 0),
      };
    });
  }, [data, groupBy]);
  const hasSales = Number(data?.count.total ?? 0) > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{evolutionTitle} - Ventas</CardTitle>
          <CardDescription>{revenueDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Cargando datos...</p>}
          {!isLoading && !hasSales && (
            <p className="text-sm text-muted-foreground">Sin datos en el periodo seleccionado.</p>
          )}
          <div className="w-full h-[300px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="var(--color-ventas)"
                    strokeWidth={3}
                    dot={{ fill: "var(--color-ventas)", strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{evolutionTitle} - Pedidos</CardTitle>
          <CardDescription>{volumeDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[300px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="pedidos" fill="var(--color-pedidos)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
