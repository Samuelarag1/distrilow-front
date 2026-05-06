"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Target,
  Download,
} from "lucide-react";
import { SalesChart } from "@/components/sales/sales-chart";
import { DailySales } from "@/components/sales/daily-sales";
import { SalesTable } from "@/components/sales/sales-table";
import { GrowthAnalysis } from "@/components/sales/growth-analysis";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import { fetchReportingSalesSeries } from "@/lib/reports/reporting-sales-history";

function startOfDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0
  );
}

function endOfDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    23,
    59,
    59,
    999
  );
}

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string, boundary: "start" | "end") {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  return boundary === "start" ? startOfDay(date) : endOfDay(date);
}

function getCurrentMonthToDateInputs() {
  const now = new Date();
  return {
    from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toInputDate(now),
  };
}

function buildDateRange(fromInput: string, toInput: string) {
  if (!fromInput || !toInput) {
    const defaults = getCurrentMonthToDateInputs();
    return buildDateRange(defaults.from, defaults.to);
  }

  const from = parseInputDate(fromInput, "start");
  const to = parseInputDate(toInput, "end");

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    const defaults = getCurrentMonthToDateInputs();
    return buildDateRange(defaults.from, defaults.to);
  }

  if (from.getTime() <= to.getTime()) {
    return { from, to };
  }

  return {
    from: startOfDay(to),
    to: endOfDay(from),
  };
}

function getPreviousEquivalentRange(range: { from: Date; to: Date }) {
  const duration = range.to.getTime() - range.from.getTime();
  const previousTo = new Date(range.from.getTime() - 1);
  return {
    from: startOfDay(new Date(previousTo.getTime() - duration)),
    to: endOfDay(previousTo),
  };
}

function pct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function SalesModule() {
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");
  const defaultDateInputs = useMemo(() => getCurrentMonthToDateInputs(), []);
  const [fromInput, setFromInput] = useState(defaultDateInputs.from);
  const [toInput, setToInput] = useState(defaultDateInputs.to);
  const { toast } = useToast();
  const { branchId } = useUser();
  const monthlyConfig = useMemo(() => {
    const current = buildDateRange(fromInput, toInput);
    return {
      current,
      previous: getPreviousEquivalentRange(current),
    };
  }, [fromInput, toInput]);
  const { data: monthlyReporting } = useSWR(
    branchId
      ? [
          "sales-module-monthly-reporting",
          branchId,
          monthlyConfig.current.from.toISOString(),
          monthlyConfig.current.to.toISOString(),
          monthlyConfig.previous.from.toISOString(),
          monthlyConfig.previous.to.toISOString(),
        ]
      : null,
    async () => {
      const [currentSeries, previousSeries] = await Promise.all([
        fetchReportingSalesSeries(monthlyConfig.current, "day", [
          "revenue",
          "profit",
          "count",
          "avgTicket",
        ]),
        fetchReportingSalesSeries(monthlyConfig.previous, "day", [
          "revenue",
          "profit",
          "count",
          "avgTicket",
        ]),
      ]);

      return { currentSeries, previousSeries };
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );
  const { data: salesSummary, isLoading: isSummaryLoading } = useSWR(
    branchId ? ["sales-module-summary", branchId] : null,
    () => backendApi.reporting.sales.summary(),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const metrics = useMemo(() => {
    const todayRevenue = Number(salesSummary?.today.revenue ?? 0);
    const yesterdayRevenue = Number(salesSummary?.yesterday?.revenue ?? 0);
    const todayOrders = Number(salesSummary?.today.orders ?? 0);
    const yesterdayOrders = Number(salesSummary?.yesterday?.orders ?? 0);
    const todayAvgOrder = Number(salesSummary?.today.avgTicket ?? 0);
    const yesterdayAvgOrder = Number(salesSummary?.yesterday?.avgTicket ?? 0);
    const reportingMonthRevenue = Number(
      monthlyReporting?.currentSeries.revenue.total ??
        salesSummary?.rollingMonth.revenue ??
        0
    );
    const reportingPrevMonthRevenue = Number(
      monthlyReporting?.previousSeries.revenue.total ??
        salesSummary?.previousRollingMonth?.revenue ??
        0
    );
    const reportingMonthOrders = Number(
      monthlyReporting?.currentSeries.count.total ??
        salesSummary?.rollingMonth.orders ??
        0
    );
    const reportingPrevMonthOrders = Number(
      monthlyReporting?.previousSeries.count.total ??
        salesSummary?.previousRollingMonth?.orders ??
        0
    );
    const reportingMonthAvgOrder = Number(
      monthlyReporting?.currentSeries.avgTicket.total ??
        salesSummary?.rollingMonth.avgTicket ??
        0
    );
    const reportingPrevMonthAvgOrder = Number(
      monthlyReporting?.previousSeries.avgTicket.total ??
        salesSummary?.previousRollingMonth?.avgTicket ??
        0
    );
    const reportingMonthProfit = Number(
      monthlyReporting?.currentSeries.profit.total ?? 0
    );
    const reportingPrevMonthProfit = Number(
      monthlyReporting?.previousSeries.profit.total ?? 0
    );

    return {
      today: {
        sales: todayRevenue,
        orders: todayOrders,
        avgOrder: todayAvgOrder,
        growth: salesSummary?.today.revenueGrowthPct ?? pct(todayRevenue, yesterdayRevenue),
        ordersGrowth:
          salesSummary?.today.ordersGrowthPct ?? pct(todayOrders, yesterdayOrders),
        avgOrderGrowth:
          salesSummary?.today.avgTicketGrowthPct ??
          pct(todayAvgOrder, yesterdayAvgOrder),
      },
      monthly: {
        sales: reportingMonthRevenue,
        profit: reportingMonthProfit,
        orders: reportingMonthOrders,
        avgOrder: reportingMonthAvgOrder,
        growth: pct(reportingMonthRevenue, reportingPrevMonthRevenue),
        profitGrowth: pct(reportingMonthProfit, reportingPrevMonthProfit),
        ordersGrowth: pct(reportingMonthOrders, reportingPrevMonthOrders),
        avgOrderGrowth: pct(reportingMonthAvgOrder, reportingPrevMonthAvgOrder),
      },
    };
  }, [monthlyReporting, salesSummary]);

  const handleExport = (format: string) => {
    toast({
      title: "Exportando datos",
      description: `Generando reporte de ventas en formato ${format.toUpperCase()}...`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analisis de Ventas</h1>
          <p className="text-muted-foreground">Seguimiento completo del rendimiento de ventas</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Desde
            </label>
            <Input
              type="date"
              value={fromInput}
              onChange={(event) => setFromInput(event.target.value)}
              className="w-full sm:w-40"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Hasta
            </label>
            <Input
              type="date"
              value={toInput}
              onChange={(event) => setToInput(event.target.value)}
              className="w-full sm:w-40"
            />
          </div>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {isSummaryLoading && <p className="text-sm text-muted-foreground">Cargando ventas...</p>}

      <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="daily">Diario</TabsTrigger>
          <TabsTrigger value="monthly">Mensual</TabsTrigger>
          <TabsTrigger value="quarterly">Trimestral</TabsTrigger>
          <TabsTrigger value="yearly">Anual</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ventas Hoy</p>
                    <p className="text-2xl font-bold">${metrics.today.sales.toLocaleString()}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      <span className="text-green-500">{metrics.today.growth.toFixed(1)}%</span>
                      <span className="text-muted-foreground ml-1">vs ayer</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ganancias del Periodo</p>
                    <p className="text-2xl font-bold">${metrics.monthly.profit.toLocaleString()}</p>
                    <div className="flex items-center text-xs mt-1">
                      {metrics.monthly.profitGrowth >= 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      )}
                      <span className={metrics.monthly.profitGrowth >= 0 ? "text-green-500" : "text-orange-500"}>
                        {metrics.monthly.profitGrowth.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground ml-1">vs periodo anterior</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pedidos Hoy</p>
                    <p className="text-2xl font-bold">{metrics.today.orders}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingUp className="mr-1 h-3 w-3 text-blue-500" />
                      <span className="text-blue-500">{metrics.today.ordersGrowth.toFixed(1)}%</span>
                      <span className="text-muted-foreground ml-1">vs ayer</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ticket Promedio</p>
                    <p className="text-2xl font-bold">${metrics.today.avgOrder.toFixed(2)}</p>
                    <div className="flex items-center text-xs mt-1">
                      {metrics.today.avgOrderGrowth >= 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      )}
                      <span className={metrics.today.avgOrderGrowth >= 0 ? "text-green-500" : "text-orange-500"}>
                        {metrics.today.avgOrderGrowth.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground ml-1">vs ayer</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                    <Target className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DailySales />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ventas del Periodo</p>
                    <p className="text-2xl font-bold">${metrics.monthly.sales.toLocaleString()}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      <span className="text-green-500">{metrics.monthly.growth.toFixed(1)}%</span>
                      <span className="text-muted-foreground ml-1">vs periodo anterior</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pedidos del Periodo</p>
                    <p className="text-2xl font-bold">{metrics.monthly.orders}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingUp className="mr-1 h-3 w-3 text-blue-500" />
                      <span className="text-blue-500">{metrics.monthly.ordersGrowth.toFixed(1)}%</span>
                      <span className="text-muted-foreground ml-1">vs periodo anterior</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ticket Promedio</p>
                    <p className="text-2xl font-bold">${metrics.monthly.avgOrder.toFixed(2)}</p>
                    <div className="flex items-center text-xs mt-1">
                      {metrics.monthly.avgOrderGrowth >= 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      )}
                      <span className={metrics.monthly.avgOrderGrowth >= 0 ? "text-green-500" : "text-orange-500"}>
                        {metrics.monthly.avgOrderGrowth.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground ml-1">vs periodo anterior</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                    <Target className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <SalesChart period="monthly" dateRange={monthlyConfig.current} />
          <GrowthAnalysis
            period="monthly"
            dateRange={monthlyConfig.current}
            previousDateRange={monthlyConfig.previous}
          />
        </TabsContent>

        <TabsContent value="quarterly" className="space-y-6">
          <SalesChart period="quarterly" />
          <GrowthAnalysis period="quarterly" />
        </TabsContent>

        <TabsContent value="yearly" className="space-y-6">
          <SalesChart period="yearly" />
          <GrowthAnalysis period="yearly" />
        </TabsContent>
      </Tabs>

      <SalesTable />
    </div>
  );
}
