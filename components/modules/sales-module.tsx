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
  Percent,
} from "lucide-react";
import { SalesChart } from "@/components/sales/sales-chart";
import { DailySales } from "@/components/sales/daily-sales";
import { SalesTable } from "@/components/sales/sales-table";
import { GrowthAnalysis } from "@/components/sales/growth-analysis";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import { fetchReportingSalesSeries } from "@/lib/reports/reporting-sales-history";

const SALES_TZ = "America/Argentina/Cordoba";

const salesTzFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SALES_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toArgYmd(date: Date): string {
  return salesTzFormatter.format(date);
}

// Argentina is UTC-3 year-round (no DST).
// Argentina midnight = 03:00 UTC; Argentina 23:59:59.999 = next day 02:59:59.999 UTC.
function parseYmdToStart(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 3, 0, 0, 0));
}

function parseYmdToEnd(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + 1, 2, 59, 59, 999));
}

function startOfDay(value: Date) {
  return parseYmdToStart(toArgYmd(value));
}

function endOfDay(value: Date) {
  return parseYmdToEnd(toArgYmd(value));
}

function toInputDate(value: Date) {
  return toArgYmd(value);
}

function parseInputDate(value: string, boundary: "start" | "end") {
  return boundary === "start" ? parseYmdToStart(value) : parseYmdToEnd(value);
}

function getCurrentMonthToDateInputs() {
  const todayStr = toArgYmd(new Date());
  const [year, month] = todayStr.split("-").map(Number);
  return {
    from: `${String(year).padStart(4, "0")}-${String(month || 1).padStart(2, "0")}-01`,
    to: todayStr,
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
  const { data: monthlyReporting, isValidating: isMonthlyLoading } = useSWR(
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

  const { data: priceTypesSummary } = useSWR(
    branchId
      ? ["sales-price-types-summary", branchId, fromInput, toInput]
      : null,
    () =>
      backendApi.reporting.sales.priceTypes.summary({
        from: fromInput,
        to: toInput,
      }),
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
    const reportingMonthRevenue = Number(monthlyReporting?.currentSeries.revenue.total ?? 0);
    const reportingPrevMonthRevenue = Number(monthlyReporting?.previousSeries.revenue.total ?? 0);
    const reportingMonthOrders = Number(monthlyReporting?.currentSeries.count.total ?? 0);
    const reportingPrevMonthOrders = Number(monthlyReporting?.previousSeries.count.total ?? 0);
    const reportingMonthAvgOrder = Number(monthlyReporting?.currentSeries.avgTicket.total ?? 0);
    const reportingPrevMonthAvgOrder = Number(monthlyReporting?.previousSeries.avgTicket.total ?? 0);
    const reportingMonthProfit = Number(monthlyReporting?.currentSeries.profit.total ?? 0);
    const reportingPrevMonthProfit = Number(monthlyReporting?.previousSeries.profit.total ?? 0);
    const reportingMonthMarginPct =
      reportingMonthRevenue > 0
        ? (reportingMonthProfit / reportingMonthRevenue) * 100
        : 0;
    const reportingPrevMonthMarginPct =
      reportingPrevMonthRevenue > 0
        ? (reportingPrevMonthProfit / reportingPrevMonthRevenue) * 100
        : 0;

    return {
      today: {
        sales: todayRevenue,
        orders: todayOrders,
        avgOrder: todayAvgOrder,
        growth: pct(todayRevenue, yesterdayRevenue),
        ordersGrowth: pct(todayOrders, yesterdayOrders),
        avgOrderGrowth: pct(todayAvgOrder, yesterdayAvgOrder),
      },
      monthly: {
        sales: reportingMonthRevenue,
        profit: reportingMonthProfit,
        marginPct: reportingMonthMarginPct,
        orders: reportingMonthOrders,
        avgOrder: reportingMonthAvgOrder,
        growth: pct(reportingMonthRevenue, reportingPrevMonthRevenue),
        profitGrowth: pct(reportingMonthProfit, reportingPrevMonthProfit),
        marginPctDelta: reportingMonthMarginPct - reportingPrevMonthMarginPct,
        ordersGrowth: pct(reportingMonthOrders, reportingPrevMonthOrders),
        avgOrderGrowth: pct(reportingMonthAvgOrder, reportingPrevMonthAvgOrder),
      },
    };
  }, [monthlyReporting, salesSummary]);

  const priceBreakdown = useMemo(() => {
    const items = priceTypesSummary?.items ?? [];
    const find = (key: string) => items.find((i) => (i.key ?? i.priceType) === key);
    const retail = find("RETAIL");
    const wholesale = find("WHOLESALE");

    function bucketMarginPct(item: typeof retail) {
      if (!item) return null;
      if (item.marginPercent != null && Number.isFinite(Number(item.marginPercent))) {
        return Number(item.marginPercent);
      }
      const rev = Number(item.revenueTotal ?? 0);
      const profit = Number(item.profitTotal ?? item.profit ?? 0);
      return rev > 0 ? (profit / rev) * 100 : 0;
    }

    return {
      retail: {
        marginPct: bucketMarginPct(retail),
        revenue: Number(retail?.revenueTotal ?? 0),
        profit: Number(retail?.profitTotal ?? retail?.profit ?? 0),
        units: Number(retail?.unitsTotal ?? 0),
      },
      wholesale: {
        marginPct: bucketMarginPct(wholesale),
        revenue: Number(wholesale?.revenueTotal ?? 0),
        profit: Number(wholesale?.profitTotal ?? wholesale?.profit ?? 0),
        units: Number(wholesale?.unitsTotal ?? 0),
      },
      totalMarginPct:
        priceTypesSummary?.totals?.marginPercent != null
          ? Number(priceTypesSummary.totals.marginPercent)
          : null,
    };
  }, [priceTypesSummary]);

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
                      {metrics.today.growth >= 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      )}
                      <span className={metrics.today.growth >= 0 ? "text-green-500" : "text-orange-500"}>
                        {metrics.today.growth >= 0 ? "+" : ""}{metrics.today.growth.toFixed(1)}%
                      </span>
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
                        {metrics.monthly.profitGrowth >= 0 ? "+" : ""}{metrics.monthly.profitGrowth.toFixed(1)}%
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
                      {metrics.today.ordersGrowth >= 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-blue-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      )}
                      <span className={metrics.today.ordersGrowth >= 0 ? "text-blue-500" : "text-orange-500"}>
                        {metrics.today.ordersGrowth >= 0 ? "+" : ""}{metrics.today.ordersGrowth.toFixed(1)}%
                      </span>
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
                    <p className="text-2xl font-bold">
                      {isMonthlyLoading ? (
                        <span className="text-muted-foreground text-base">Cargando...</span>
                      ) : (
                        `$${metrics.monthly.sales.toLocaleString()}`
                      )}
                    </p>
                    <div className="flex items-center text-xs mt-1">
                      {metrics.monthly.growth >= 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      )}
                      <span className={metrics.monthly.growth >= 0 ? "text-green-500" : "text-orange-500"}>
                        {metrics.monthly.growth >= 0 ? "+" : ""}{metrics.monthly.growth.toFixed(1)}%
                      </span>
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
                    <p className="text-sm font-medium text-muted-foreground">Ganancia del Periodo</p>
                    <p className="text-2xl font-bold">
                      {isMonthlyLoading ? (
                        <span className="text-muted-foreground text-base">Cargando...</span>
                      ) : (
                        `$${metrics.monthly.profit.toLocaleString()}`
                      )}
                    </p>
                    <div className="flex items-center text-xs mt-1">
                      {metrics.monthly.profitGrowth >= 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      )}
                      <span className={metrics.monthly.profitGrowth >= 0 ? "text-emerald-500" : "text-orange-500"}>
                        {metrics.monthly.profitGrowth >= 0 ? "+" : ""}{metrics.monthly.profitGrowth.toFixed(1)}%
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
                    <p className="text-sm font-medium text-muted-foreground">Margen del Periodo</p>
                    <p className="text-2xl font-bold">
                      {isMonthlyLoading ? (
                        <span className="text-muted-foreground text-base">Cargando...</span>
                      ) : (
                        `${metrics.monthly.marginPct.toFixed(1)}%`
                      )}
                    </p>
                    <div className="flex items-center text-xs mt-1">
                      {metrics.monthly.marginPctDelta >= 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-violet-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      )}
                      <span className={metrics.monthly.marginPctDelta >= 0 ? "text-violet-500" : "text-orange-500"}>
                        {metrics.monthly.marginPctDelta >= 0 ? "+" : ""}
                        {metrics.monthly.marginPctDelta.toFixed(1)} pp
                      </span>
                      <span className="text-muted-foreground ml-1">vs periodo anterior</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
                    <Percent className="h-4 w-4 text-violet-600" />
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
                      {metrics.monthly.ordersGrowth >= 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-blue-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      )}
                      <span className={metrics.monthly.ordersGrowth >= 0 ? "text-blue-500" : "text-orange-500"}>
                        {metrics.monthly.ordersGrowth >= 0 ? "+" : ""}{metrics.monthly.ordersGrowth.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground ml-1">vs periodo anterior</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* <Card>
            <CardContent className="p-6">
              <p className="text-sm font-semibold mb-4">Margen real por canal de precio</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Minorista</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {priceBreakdown.retail.marginPct != null
                      ? `${priceBreakdown.retail.marginPct.toFixed(1)}%`
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ganancia: ${priceBreakdown.retail.profit.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Facturado: ${priceBreakdown.retail.revenue.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mayorista</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {priceBreakdown.wholesale.marginPct != null
                      ? `${priceBreakdown.wholesale.marginPct.toFixed(1)}%`
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ganancia: ${priceBreakdown.wholesale.profit.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Facturado: ${priceBreakdown.wholesale.revenue.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-lg border bg-violet-50 border-violet-200 p-4 space-y-1">
                  <p className="text-xs font-medium text-violet-700 uppercase tracking-wide">Total combinado</p>
                  <p className="text-2xl font-bold text-violet-700">
                    {priceBreakdown.totalMarginPct != null
                      ? `${Number(priceBreakdown.totalMarginPct).toFixed(1)}%`
                      : metrics.monthly.marginPct > 0
                      ? `${metrics.monthly.marginPct.toFixed(1)}%`
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ganancia total: ${metrics.monthly.profit.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sobre precio de venta real
                  </p>
                </div>
              </div>
            </CardContent>
          </Card> */}

          <SalesChart
            period="monthly"
            dateRange={monthlyConfig.current}
            preloadedData={monthlyReporting?.currentSeries}
          />
          <GrowthAnalysis
            period="monthly"
            dateRange={monthlyConfig.current}
            previousDateRange={monthlyConfig.previous}
            preloadedCurrent={monthlyReporting?.currentSeries}
            preloadedPrevious={monthlyReporting?.previousSeries}
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
