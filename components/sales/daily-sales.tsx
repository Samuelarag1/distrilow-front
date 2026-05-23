"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Landmark, ShoppingCart, Target, Wallet } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useUser } from "@/components/providers/user-provider";
import {
  formatReportingPeriodLabel,
  fetchReportingSalesSeries,
} from "@/lib/reports/reporting-sales-history";
import { backendApi } from "@/lib/backend-api";

const chartConfig = {
  ventas: {
    label: "Ventas ($)",
    color: "hsl(var(--chart-1))",
  },
};

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  });
}

const DAILY_SALES_TZ = "America/Argentina/Cordoba";
const dailySalesTzFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DAILY_SALES_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function makeArgentinaDayBoundary(ymd: string, boundary: "start" | "end"): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  // Argentina is UTC-3 year-round. Midnight ART = 03:00 UTC.
  return boundary === "start"
    ? new Date(Date.UTC(year, (month || 1) - 1, day || 1, 3, 0, 0, 0))
    : new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + 1, 2, 59, 59, 999));
}

const DAILY_TREND_DAYS = 14;

export function DailySales() {
  const { branchId } = useUser();
  const dailyRange = useMemo(() => {
    const todayYmd = dailySalesTzFormatter.format(new Date());
    const [year, month, day] = todayYmd.split("-").map(Number);
    const fromDate = new Date(Date.UTC(year, (month || 1) - 1, (day || 1) - (DAILY_TREND_DAYS - 1), 3, 0, 0, 0));
    const fromYmd = dailySalesTzFormatter.format(fromDate);
    return {
      from: makeArgentinaDayBoundary(fromYmd, "start"),
      to: makeArgentinaDayBoundary(todayYmd, "end"),
    };
  }, []);
  const { data: dailyReporting, isLoading: isDailyTrendLoading } = useSWR(
    branchId
      ? [
          "daily-sales-reporting",
          branchId,
          dailyRange.from.toISOString(),
          dailyRange.to.toISOString(),
        ]
      : null,
    () => fetchReportingSalesSeries(dailyRange, "day", ["revenue"]),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );
  const { data: salesSummary, isLoading: isSummaryLoading } = useSWR(
    branchId ? ["daily-sales-summary", branchId] : null,
    () => backendApi.reporting.sales.summary(),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const dailyTrend = useMemo(
    () =>
      (dailyReporting?.revenue.points ?? []).map((point) => {
        return {
          name: formatReportingPeriodLabel(point.period, "day"),
          ventas: Number(point.value ?? 0),
        };
      }),
    [dailyReporting]
  );

  const todaySummary = salesSummary?.today;
  const totalSales = Number(todaySummary?.revenue ?? 0);
  const completedOrders = Number(todaySummary?.orders ?? 0);
  const avgOrder = completedOrders > 0 ? totalSales / completedOrders : 0;
  const cashIncome = Number(todaySummary?.cashIncome ?? 0);
  const transferIncome = Number(todaySummary?.transferIncome ?? 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Evolucion diaria (ultimos 14 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {isDailyTrendLoading && (
            <div className="mb-3 text-sm text-muted-foreground">
              Cargando evolucion diaria...
            </div>
          )}
          <div className="w-full h-[280px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailyTrend}
                  margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                >
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
                    activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analisis diario</CardTitle>
        </CardHeader>
        <CardContent>
          {isSummaryLoading && (
            <div className="text-sm text-muted-foreground">
              Cargando metricas de hoy...
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <DollarSign className="h-8 w-8 mx-auto text-green-500" />
                  <p className="text-sm text-muted-foreground">Total del dia</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${formatMoney(totalSales)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <ShoppingCart className="h-8 w-8 mx-auto text-blue-500" />
                  <p className="text-sm text-muted-foreground">
                    Ordenes completadas
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {completedOrders}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <Target className="h-8 w-8 mx-auto text-purple-500" />
                  <p className="text-sm text-muted-foreground">Ticket promedio</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${formatMoney(avgOrder)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <Wallet className="h-8 w-8 mx-auto text-emerald-500" />
                  <p className="text-sm text-muted-foreground">Ingreso efectivo</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    ${formatMoney(cashIncome)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <Landmark className="h-8 w-8 mx-auto text-sky-500" />
                  <p className="text-sm text-muted-foreground">
                    Ingreso transferencia
                  </p>
                  <p className="text-2xl font-bold text-sky-600">
                    ${formatMoney(transferIncome)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            El detalle de cada venta se consulta en Historial de Ventas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
