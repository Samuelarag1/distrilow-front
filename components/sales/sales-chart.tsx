"use client";

import { useMemo } from "react";
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
import { useTransactions } from "@/components/providers/transactions-provider";
import {
  aggregateSalesTrend,
  formatSalesTrendLabel,
  getSalesAnalysisConfig,
  type SalesAnalysisPeriod,
} from "@/lib/reports/sales-trends";

interface SalesChartProps {
  period: SalesAnalysisPeriod;
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
  clientes: {
    label: "Clientes",
    color: "hsl(var(--chart-3))",
  },
};

export function SalesChart({ period }: SalesChartProps) {
  const { sales, isLoading } = useTransactions();
  const config = useMemo(() => getSalesAnalysisConfig(period), [period]);
  const { current, groupBy } = config;
  const trend = useMemo(
    () => aggregateSalesTrend(sales, current, groupBy),
    [sales, current, groupBy]
  );

  const chartData = useMemo(() => {
    return trend.points.map((point) => ({
      name: formatSalesTrendLabel(point.start, groupBy),
      ventas: point.revenue,
      pedidos: point.count,
      clientes: point.customers,
    }));
  }, [trend.points, groupBy]);
  const hasSales = trend.totals.count > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{config.evolutionTitle} - Ventas</CardTitle>
          <CardDescription>{config.revenueDescription}</CardDescription>
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
          <CardTitle>{config.evolutionTitle} - Pedidos y Clientes</CardTitle>
          <CardDescription>{config.volumeDescription}</CardDescription>
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
                  <Bar dataKey="clientes" fill="var(--color-clientes)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
