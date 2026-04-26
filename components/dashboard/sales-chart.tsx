"use client";

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
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { useUser } from "@/components/providers/user-provider";
import {
  formatReportingPeriodLabel,
} from "@/lib/reports/reporting-sales-history";
import { backendApi } from "@/lib/backend-api";

const reportingDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function shiftDateKey(dateKey: string, deltaDays: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const base = new Date(year, (month || 1) - 1, day || 1);
  base.setDate(base.getDate() + deltaDays);
  return reportingDateFormatter.format(base);
}

export function SalesChart() {
  const { branchId } = useUser();
  const toKey = reportingDateFormatter.format(new Date());
  const fromKey = shiftDateKey(toKey, -6);
  const { data, error, isLoading } = useSWR(
    branchId
      ? [
          "dashboard-sales-chart",
          branchId,
          fromKey,
          toKey,
        ]
      : null,
    async () => {
      const [revenue, count] = await Promise.all([
        backendApi.reporting.sales.history({
          from: fromKey ?? "",
          to: toKey ?? "",
          groupBy: "day",
          metric: "revenue",
        }),
        backendApi.reporting.sales.history({
          from: fromKey ?? "",
          to: toKey ?? "",
          groupBy: "day",
          metric: "count",
        }),
      ]);

      return {
        revenuePoints: revenue.points ?? [],
        countPoints: count.points ?? [],
      };
    },
    {
      keepPreviousData: true,
    }
  );

  if (!branchId) return null;

  const revenuePoints = data?.revenuePoints ?? [];
  const countByPeriod = new Map(
    (data?.countPoints ?? []).map((point) => [point.period, point.value])
  );
  const chartData = revenuePoints.map((point) => ({
    name: formatReportingPeriodLabel(point.period, "day"),
    ventas: Number(point.value ?? 0),
    pedidos: Number(countByPeriod.get(point.period) ?? 0),
  }));
  const weekLabel = `${formatReportingPeriodLabel(fromKey, "day", "long")} al ${formatReportingPeriodLabel(toKey, "day", "long")}`;

  const chartConfig = {
    ventas: { label: "Ventas", color: "hsl(var(--chart-1))" },
    pedidos: { label: "Pedidos", color: "hsl(var(--chart-2))" },
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">
          Desempeño de Ventas (7 dias)
        </CardTitle>
        <CardDescription className="text-sm">
          {weekLabel}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {isLoading && (
          <p className="mb-3 text-sm text-muted-foreground">
            Cargando rendimiento de ventas...
          </p>
        )}
        {error && (
          <p className="mb-3 rounded-md border border-destructive/50 p-3 text-sm text-destructive">
            No se pudo cargar el rendimiento de ventas.
          </p>
        )}
        {!isLoading && !error && chartData.length === 0 && (
          <p className="mb-3 text-sm text-muted-foreground">
            No hay ventas para el rango seleccionado.
          </p>
        )}
        <div className="w-full h-[250px] sm:h-[300px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                  width={45}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  stackId="1"
                  stroke="var(--color-ventas)"
                  fill="var(--color-ventas)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="pedidos"
                  stackId="1"
                  stroke="var(--color-pedidos)"
                  fill="var(--color-pedidos)"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
