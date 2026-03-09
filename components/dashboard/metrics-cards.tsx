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
  change: string;
  trend: "up" | "down";
  icon: ComponentType<{ className?: string }>;
  description: string;
  color: string;
  bg: string;
  details?: string[];
};

export function MetricsCards({ metrics, type }: MetricsCardsProps) {
  const { sales, expenses } = useTransactions();
  const currencyFormatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  });

  const hasLiveTransactions = sales.length > 0 || expenses.length > 0;
  const liveRevenue = sales.reduce(
    (acc, sale) => acc + Number(sale.amount ?? 0),
    0
  );
  const liveExpenses = expenses.reduce(
    (acc, expense) => acc + Number(expense.amount ?? 0),
    0
  );

  const totalRevenue = hasLiveTransactions
    ? liveRevenue
    : Number(metrics.totalRevenue ?? 0);
  const totalExpenses = hasLiveTransactions
    ? liveExpenses
    : Number(metrics.operationalExpenses ?? 0);
  const netProfit = hasLiveTransactions
    ? totalRevenue - totalExpenses
    : Number(metrics.netProfit ?? totalRevenue - totalExpenses);
  const revenueTrend = metrics.growthTrend ?? "+0%";
  const netProfitTrend: "up" | "down" = netProfit >= 0 ? "up" : "down";

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

  const commonMetrics: MetricCard[] = [
    {
      title: "Ingresos Totales",
      value: currencyFormatter.format(totalRevenue),
      change: revenueTrend,
      trend: revenueTrend.trim().startsWith("-") ? "down" : "up",
      icon: DollarSign,
      description: "vs mes anterior",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Gastos Operativos",
      value: currencyFormatter.format(totalExpenses),
      change: "+5.2%",
      trend: "down",
      icon: Receipt,
      description: "mes actual",
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      title: "Ganancia Neta",
      value: currencyFormatter.format(netProfit),
      change: "+8.4%",
      trend: netProfitTrend,
      icon: PiggyBank,
      description: "margen proyectado",
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  ];

  const retailMetrics: MetricCard[] = [
    {
      title: "Caja Diaria",
      value: currencyFormatter.format(dailyCash),
      change: "+2.4%",
      trend: "up",
      icon: Wallet,
      description: "saldo actual",
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
        const TrendIcon = metric.trend === "up" ? TrendingUp : TrendingDown;

        return (
          <Card
            key={metric.title}
            className="cursor-pointer border-l-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            style={{
              borderLeftColor: metric.trend === "up" ? "#22c55e" : "#ef4444",
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
              <div className="flex items-center text-xs">
                <TrendIcon
                  className={`mr-1 h-3 w-3 ${
                    metric.trend === "up" ? "text-green-500" : "text-red-500"
                  }`}
                />
                <span
                  className={`font-medium ${
                    metric.trend === "up" ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {metric.change}
                </span>
                <span className="ml-1 text-muted-foreground">
                  {metric.description}
                </span>
              </div>
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
