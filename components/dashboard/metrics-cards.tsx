"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComponentType } from "react";
import {
  CreditCard,
  DollarSign,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { DashboardMetrics, BusinessType } from "@/lib/data-service";
import { useTransactions } from "@/components/providers/transactions-provider";

interface MetricsCardsProps {
  metrics: DashboardMetrics;
  type: BusinessType;
}

type MetricCard = {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down";
  icon: ComponentType<{ className?: string }>;
  description?: string;
  color: string;
  bg: string;
  details?: string[];
};

function computePercentageChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) {
    if (current === 0) return 0;
    return current > 0 ? 100 : -100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatPercentage(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const normalized = Math.abs(safeValue) < 0.05 ? 0 : safeValue;
  const sign = normalized > 0 ? "+" : "";
  return `${sign}${normalized.toFixed(1)}%`;
}

function sumInRange(
  rows: Array<{ amount: number; date: string }>,
  startMs: number,
  endMs: number
) {
  return rows.reduce((acc, row) => {
    const dateMs = new Date(row.date).getTime();
    if (!Number.isFinite(dateMs)) return acc;
    if (dateMs < startMs || dateMs >= endMs) return acc;
    return acc + Number(row.amount ?? 0);
  }, 0);
}

export function MetricsCards({ metrics, type }: MetricsCardsProps) {
  const { getSalesByType, getExpensesByType } = useTransactions();
  const sales = getSalesByType(type);
  const expenses = getExpensesByType(type);
  const currencyFormatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  });

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonthStartMs = currentMonthStart.getTime();
  const nextMonthStartMs = nextMonthStart.getTime();
  const previousMonthStartMs = previousMonthStart.getTime();

  const currentRevenueFromTransactions = sumInRange(
    sales,
    currentMonthStartMs,
    nextMonthStartMs
  );
  const previousRevenueFromTransactions = sumInRange(
    sales,
    previousMonthStartMs,
    currentMonthStartMs
  );
  const currentExpensesFromTransactions = sumInRange(
    expenses,
    currentMonthStartMs,
    nextMonthStartMs
  );
  const previousExpensesFromTransactions = sumInRange(
    expenses,
    previousMonthStartMs,
    currentMonthStartMs
  );
  const currentNetProfitFromTransactions =
    currentRevenueFromTransactions - currentExpensesFromTransactions;
  const previousNetProfitFromTransactions =
    previousRevenueFromTransactions - previousExpensesFromTransactions;

  const hasLiveTransactions = sales.length > 0 || expenses.length > 0;

  const totalRevenue = Number(metrics?.totalRevenue ?? 0);
  const totalExpenses = hasLiveTransactions
    ? currentExpensesFromTransactions
    : Number(metrics.operationalExpenses ?? 0);

  const netProfit = (metrics.netProfit ?? 0);

  const revenueGrowthPct = hasLiveTransactions
    ? computePercentageChange(
        currentRevenueFromTransactions,
        previousRevenueFromTransactions
      )
    : 0;
  const expensesGrowthPct = hasLiveTransactions
    ? computePercentageChange(
        currentExpensesFromTransactions,
        previousExpensesFromTransactions
      )
    : 0;
  const netProfitGrowthPct = hasLiveTransactions
    ? computePercentageChange(
        currentNetProfitFromTransactions,
        previousNetProfitFromTransactions
      )
    : 0;

  const revenueChange = hasLiveTransactions
    ? formatPercentage(revenueGrowthPct)
    : metrics.growthTrend ?? "+0%";
  const expensesChange = formatPercentage(expensesGrowthPct);
  const netProfitChange = formatPercentage(netProfitGrowthPct);
  const revenueTrend: "up" | "down" = hasLiveTransactions
    ? revenueGrowthPct < 0
      ? "down"
      : "up"
    : String(metrics.growthTrend ?? "")
        .trim()
        .startsWith("-")
    ? "down"
    : "up";
  const expensesTrend: "up" | "down" = expensesGrowthPct > 0 ? "down" : "up";
  const netProfitTrend: "up" | "down" = netProfitGrowthPct < 0 ? "down" : "up";

  const dailyCash = Number(metrics.dailyCashbox ?? 0);
  const dailyCashBreakdown = metrics.dailyCashBreakdown;
  const hasDailyCashBreakdown =
    Boolean(dailyCashBreakdown) &&
    Number.isFinite(Number(dailyCashBreakdown?.openingFloat)) &&
    Number.isFinite(Number(dailyCashBreakdown?.cashFromPayments)) &&
    Number.isFinite(Number(dailyCashBreakdown?.movementIn)) &&
    Number.isFinite(Number(dailyCashBreakdown?.movementOut));
  const formulaDailyCash = hasDailyCashBreakdown
    ? Number(dailyCashBreakdown?.openingFloat ?? 0) +
      Number(dailyCashBreakdown?.cashFromPayments ?? 0) +
      Number(dailyCashBreakdown?.movementIn ?? 0) -
      Number(dailyCashBreakdown?.movementOut ?? 0)
    : dailyCash;
  const effectiveDailyCash = hasDailyCashBreakdown
    ? formulaDailyCash
    : dailyCash;

  const commonMetrics: MetricCard[] = [
    {
      title: "Ingresos Totales",
      value: currencyFormatter.format(totalRevenue),
      icon: DollarSign,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Gastos Operativos",
      value: currencyFormatter.format(totalExpenses),
      icon: Receipt,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      title: "Ganancia Neta",
      value: currencyFormatter.format(netProfit),
      icon: PiggyBank,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  ];

  const retailMetrics: MetricCard[] = [
    {
      title: "Caja Diaria",
      value: currencyFormatter.format(effectiveDailyCash),
      icon: Wallet,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  const wholesaleMetrics: MetricCard[] = [
    {
      title: "Credito Utilizado",
      value: currencyFormatter.format(metrics.creditUtilized || 0),
      change: "+15%",
      trend: "up",
      icon: CreditCard,
      description: "cuenta corriente",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
  ];

  const specificMetrics = type === "retail" ? retailMetrics : wholesaleMetrics;
  const displayMetrics = [...commonMetrics, ...specificMetrics];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {displayMetrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <Card
            key={metric.title}
            className="cursor-pointer border-l-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            style={{
              borderLeftColor: "#22c55e",
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${metric.bg}`}
              >
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{metric.value}</div>

              {Array.isArray(metric.details) && metric.details.length > 0 && (
                <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {metric.details.map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
