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
import { backendApi } from "@/lib/backend-api";
import { useUser } from "@/components/providers/user-provider";
import { useTransactions } from "@/components/providers/transactions-provider";

interface SalesChartProps {
  period: "monthly" | "quarterly" | "yearly";
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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildRange(period: "monthly" | "quarterly" | "yearly") {
  const now = new Date();
  const from = new Date(now);

  if (period === "monthly") {
    from.setMonth(now.getMonth() - 11);
  } else if (period === "quarterly") {
    from.setMonth(now.getMonth() - 23);
  } else {
    from.setFullYear(now.getFullYear() - 4);
    from.setMonth(0, 1);
  }

  return {
    from: formatDate(from),
    to: formatDate(now),
    groupBy: period === "monthly" ? "month" : period === "quarterly" ? "quarter" : "year",
  } as const;
}

export function SalesChart({ period }: SalesChartProps) {
  const { branchId } = useUser();
  const { sales } = useTransactions();

  const range = useMemo(() => buildRange(period), [period]);

  const { data, isLoading, error } = useSWR(
    branchId
      ? ["sales-chart", branchId, period, range.from, range.to, range.groupBy]
      : null,
    async () => {
      const [revenue, count] = await Promise.all([
        backendApi.analytics.sales({
          from: range.from,
          to: range.to,
          groupBy: range.groupBy,
          metric: "revenue",
        }),
        backendApi.analytics.sales({
          from: range.from,
          to: range.to,
          groupBy: range.groupBy,
          metric: "count",
        }),
      ]);

      return { revenue, count };
    },
    { revalidateOnFocus: false }
  );

  const customerByPeriod = useMemo(() => {
    const map = new Map<string, Set<string>>();
    sales.forEach((sale) => {
      const date = new Date(sale.date);
      let key = "";
      if (period === "monthly") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (period === "quarterly") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = String(date.getFullYear());
      }

      if (!map.has(key)) map.set(key, new Set<string>());
      map.get(key)?.add(sale.customerName || "Consumidor Final");
    });

    const counts = new Map<string, number>();
    map.forEach((value, key) => counts.set(key, value.size));
    return counts;
  }, [sales, period]);

  const chartData = useMemo(() => {
    const revenuePoints = data?.revenue?.points ?? [];
    const countByPeriod = new Map(
      (data?.count?.points ?? []).map((point) => [point.period, Number(point.value ?? 0)])
    );

    return revenuePoints.map((point) => {
      const periodKey = point.period;
      return {
        name: periodKey,
        ventas: Number(point.value ?? 0),
        pedidos: Number(countByPeriod.get(periodKey) ?? 0),
        clientes: Number(customerByPeriod.get(periodKey) ?? 0),
      };
    });
  }, [data, customerByPeriod]);

  const getTitle = () => {
    switch (period) {
      case "monthly":
        return "Evolucion Mensual";
      case "quarterly":
        return "Evolucion Trimestral";
      case "yearly":
        return "Evolucion Anual";
      default:
        return "Evolucion de Ventas";
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{getTitle()} - Ventas</CardTitle>
          <CardDescription>
            Tendencia de ingresos por {period === "monthly" ? "mes" : period === "quarterly" ? "trimestre" : "ano"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Cargando datos...</p>}
          {!isLoading && error && (
            <p className="text-sm text-destructive">No se pudo cargar analitica.</p>
          )}
          {!isLoading && !error && chartData.length === 0 && (
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
          <CardTitle>{getTitle()} - Pedidos y Clientes</CardTitle>
          <CardDescription>
            Volumen de operaciones por {period === "monthly" ? "mes" : period === "quarterly" ? "trimestre" : "ano"}
          </CardDescription>
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
