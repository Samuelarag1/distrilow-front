"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target, Award, Calendar, Users } from "lucide-react";
import { backendApi } from "@/lib/backend-api";
import { useUser } from "@/components/providers/user-provider";
import { useTransactions } from "@/components/providers/transactions-provider";

interface GrowthAnalysisProps {
  period: "monthly" | "quarterly" | "yearly";
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPeriodRanges(period: "monthly" | "quarterly" | "yearly") {
  const now = new Date();

  if (period === "monthly") {
    const currentFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousTo = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
      groupBy: "day" as const,
      current: { from: toDateString(currentFrom), to: toDateString(now) },
      previous: { from: toDateString(previousFrom), to: toDateString(previousTo) },
      label: "mes",
    };
  }

  if (period === "quarterly") {
    const quarter = Math.floor(now.getMonth() / 3);
    const currentFrom = new Date(now.getFullYear(), quarter * 3, 1);
    const previousFrom = new Date(now.getFullYear(), quarter * 3 - 3, 1);
    const previousTo = new Date(now.getFullYear(), quarter * 3, 0);

    return {
      groupBy: "month" as const,
      current: { from: toDateString(currentFrom), to: toDateString(now) },
      previous: { from: toDateString(previousFrom), to: toDateString(previousTo) },
      label: "trimestre",
    };
  }

  const currentFrom = new Date(now.getFullYear(), 0, 1);
  const previousFrom = new Date(now.getFullYear() - 1, 0, 1);
  const previousTo = new Date(now.getFullYear() - 1, 11, 31);

  return {
    groupBy: "month" as const,
    current: { from: toDateString(currentFrom), to: toDateString(now) },
    previous: { from: toDateString(previousFrom), to: toDateString(previousTo) },
    label: "ano",
  };
}

function growth(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function GrowthAnalysis({ period }: GrowthAnalysisProps) {
  const { branchId } = useUser();
  const { sales } = useTransactions();
  const ranges = useMemo(() => getPeriodRanges(period), [period]);

  const { data, isLoading } = useSWR(
    branchId
      ? [
          "reporting-sales-growth",
          branchId,
          period,
          ranges.current.from,
          ranges.current.to,
        ]
      : null,
    async () => {
      const [
        revenueCurrent,
        revenuePrev,
        countCurrent,
        countPrev,
        avgTicketCurrent,
        avgTicketPrev,
      ] = await Promise.all([
        backendApi.reporting.sales.history({
          ...ranges.current,
          groupBy: ranges.groupBy,
          metric: "revenue",
        }),
        backendApi.reporting.sales.history({
          ...ranges.previous,
          groupBy: ranges.groupBy,
          metric: "revenue",
        }),
        backendApi.reporting.sales.history({
          ...ranges.current,
          groupBy: ranges.groupBy,
          metric: "count",
        }),
        backendApi.reporting.sales.history({
          ...ranges.previous,
          groupBy: ranges.groupBy,
          metric: "count",
        }),
        backendApi.reporting.sales.history({
          ...ranges.current,
          groupBy: ranges.groupBy,
          metric: "avgTicket",
        }),
        backendApi.reporting.sales.history({
          ...ranges.previous,
          groupBy: ranges.groupBy,
          metric: "avgTicket",
        }),
      ]);

      return {
        revenueCurrent,
        revenuePrev,
        countCurrent,
        countPrev,
        avgTicketCurrent,
        avgTicketPrev,
      };
    },
    { revalidateOnFocus: false }
  );

  const customersGrowth = useMemo(() => {
    const from = new Date(ranges.current.from).getTime();
    const to = new Date(ranges.current.to).getTime();
    const prevFrom = new Date(ranges.previous.from).getTime();
    const prevTo = new Date(ranges.previous.to).getTime();

    const currentCustomers = new Set(
      sales
        .filter((sale) => {
          const t = new Date(sale.date).getTime();
          return t >= from && t <= to;
        })
        .map((sale) => sale.customerName || "Consumidor Final")
    );

    const prevCustomers = new Set(
      sales
        .filter((sale) => {
          const t = new Date(sale.date).getTime();
          return t >= prevFrom && t <= prevTo;
        })
        .map((sale) => sale.customerName || "Consumidor Final")
    );

    return growth(currentCustomers.size, prevCustomers.size);
  }, [sales, ranges]);

  const retention = useMemo(() => {
    const from = new Date(ranges.current.from).getTime();
    const to = new Date(ranges.current.to).getTime();
    const counts = new Map<string, number>();

    sales
      .filter((sale) => {
        const t = new Date(sale.date).getTime();
        return t >= from && t <= to;
      })
      .forEach((sale) => {
        const key = sale.customerName || "Consumidor Final";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });

    const total = counts.size;
    const recurring = Array.from(counts.values()).filter((value) => value > 1).length;
    if (total === 0) return 0;
    return (recurring / total) * 100;
  }, [sales, ranges]);

  const points = data?.revenueCurrent.points ?? [];
  const bestPoint = points.reduce(
    (acc, point) => (point.value > acc.value ? point : acc),
    { period: "-", value: 0 }
  );

  const currentRevenue = Number(data?.revenueCurrent.totals.value ?? 0);
  const previousRevenue = Number(data?.revenuePrev.totals.value ?? 0);
  const currentCount = Number(data?.countCurrent.totals.value ?? 0);
  const previousCount = Number(data?.countPrev.totals.value ?? 0);
  const currentAvgTicket = Number(data?.avgTicketCurrent.totals.value ?? 0);
  const previousAvgTicket = Number(data?.avgTicketPrev.totals.value ?? 0);

  const salesGrowth = growth(currentRevenue, previousRevenue);
  const ordersGrowth = growth(currentCount, previousCount);
  const avgOrderGrowth = growth(currentAvgTicket, previousAvgTicket);

  const target = Math.max(currentRevenue * 1.1, 1);
  const targetProgress = Math.min(100, (currentRevenue / target) * 100);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando analisis...</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Analisis de Crecimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Crecimiento en Ventas</span>
                  <div className="flex items-center gap-1">
                    {salesGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={salesGrowth >= 0 ? "default" : "destructive"}>
                      {salesGrowth >= 0 ? "+" : ""}
                      {salesGrowth.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <Progress value={Math.min(100, Math.abs(salesGrowth))} className="h-2" />
                <p className="text-xs text-muted-foreground">vs {ranges.label} anterior</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Crecimiento en Pedidos</span>
                  <div className="flex items-center gap-1">
                    {ordersGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={ordersGrowth >= 0 ? "default" : "destructive"}>
                      {ordersGrowth >= 0 ? "+" : ""}
                      {ordersGrowth.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <Progress value={Math.min(100, Math.abs(ordersGrowth))} className="h-2" />
                <p className="text-xs text-muted-foreground">vs {ranges.label} anterior</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Crecimiento en Clientes</span>
                  <div className="flex items-center gap-1">
                    {customersGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={customersGrowth >= 0 ? "default" : "destructive"}>
                      {customersGrowth >= 0 ? "+" : ""}
                      {customersGrowth.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <Progress value={Math.min(100, Math.abs(customersGrowth))} className="h-2" />
                <p className="text-xs text-muted-foreground">vs {ranges.label} anterior</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Ticket Promedio</span>
                  <div className="flex items-center gap-1">
                    {avgOrderGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={avgOrderGrowth >= 0 ? "default" : "destructive"}>
                      {avgOrderGrowth >= 0 ? "+" : ""}
                      {avgOrderGrowth.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <Progress value={Math.min(100, Math.abs(avgOrderGrowth))} className="h-2" />
                <p className="text-xs text-muted-foreground">vs {ranges.label} anterior</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Progreso hacia Objetivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Meta de Ventas</span>
                <span className="text-sm text-muted-foreground">
                  ${currentRevenue.toLocaleString()} / ${target.toLocaleString()}
                </span>
              </div>
              <Progress value={targetProgress} className="h-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{targetProgress.toFixed(1)}% completado</span>
                <span
                  className={
                    targetProgress >= 90 ? "text-green-600" : targetProgress >= 70 ? "text-yellow-600" : "text-red-600"
                  }
                >
                  {targetProgress >= 90 ? "Excelente" : targetProgress >= 70 ? "Buen progreso" : "Necesita atencion"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <Award className="h-8 w-8 mx-auto text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Mejor {ranges.label}</p>
                <p className="font-bold">{bestPoint.period}</p>
                <p className="text-lg font-bold text-yellow-600">${Number(bestPoint.value).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <Calendar className="h-8 w-8 mx-auto text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tendencia General</p>
                <p className="font-bold">{salesGrowth >= 0 ? "Crecimiento" : "Decrecimiento"}</p>
                <Badge variant={salesGrowth >= 0 ? "default" : "destructive"} className="mt-2">
                  {salesGrowth >= 0 ? "Positiva" : "Negativa"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <Users className="h-8 w-8 mx-auto text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Retencion de Clientes</p>
                <p className="font-bold">{retention.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">Clientes recurrentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
