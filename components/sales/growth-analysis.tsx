"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target, Award, Calendar } from "lucide-react";
import { useUser } from "@/components/providers/user-provider";
import {
  getSalesAnalysisConfig,
  type SalesAnalysisPeriod,
} from "@/lib/reports/sales-trends";
import {
  formatReportingPeriodLabel,
  fetchReportingSalesSeries,
} from "@/lib/reports/reporting-sales-history";

interface GrowthAnalysisProps {
  period: SalesAnalysisPeriod;
}

function growth(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function GrowthAnalysis({ period }: GrowthAnalysisProps) {
  const { branchId } = useUser();
  const config = useMemo(() => getSalesAnalysisConfig(period), [period]);
  const { current, previous, groupBy } = config;
  const { data, isLoading } = useSWR(
    branchId
      ? [
          "reporting-growth-analysis",
          branchId,
          period,
          current.from.toISOString(),
          current.to.toISOString(),
          previous.from.toISOString(),
          previous.to.toISOString(),
          groupBy,
        ]
      : null,
    async () => {
      const [currentSeries, previousSeries] = await Promise.all([
        fetchReportingSalesSeries(current, groupBy, ["revenue", "count", "avgTicket"]),
        fetchReportingSalesSeries(previous, groupBy, ["revenue", "count", "avgTicket"]),
      ]);
      return { currentSeries, previousSeries };
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const bestPoint = useMemo(() => {
    const points = data?.currentSeries.revenue.points ?? [];
    const nonZeroPoints = points.filter((point) => point.value > 0);
    if (nonZeroPoints.length === 0) return null;

    return nonZeroPoints.reduce((acc, point) =>
      point.value > acc.value ? point : acc
    );
  }, [data]);

  const currentRevenue = Number(data?.currentSeries.revenue.total ?? 0);
  const previousRevenue = Number(data?.previousSeries.revenue.total ?? 0);
  const currentCount = Number(data?.currentSeries.count.total ?? 0);
  const previousCount = Number(data?.previousSeries.count.total ?? 0);
  const currentAvgTicket = Number(data?.currentSeries.avgTicket.total ?? 0);
  const previousAvgTicket = Number(data?.previousSeries.avgTicket.total ?? 0);

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
                <p className="text-xs text-muted-foreground">
                  vs {config.comparisonLabel} anterior
                </p>
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
                <p className="text-xs text-muted-foreground">
                  vs {config.comparisonLabel} anterior
                </p>
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
                <p className="text-xs text-muted-foreground">
                  vs {config.comparisonLabel} anterior
                </p>
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
                <p className="text-sm text-muted-foreground">{config.bestPointLabel}</p>
                <p className="font-bold">
                  {bestPoint
                    ? formatReportingPeriodLabel(bestPoint.period, groupBy, "long")
                    : "Sin ventas"}
                </p>
                <p className="text-lg font-bold text-yellow-600">
                  ${Number(bestPoint?.value ?? 0).toLocaleString()}
                </p>
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

      </div>
    </div>
  );
}
