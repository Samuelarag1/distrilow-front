"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComponentType } from "react";
import {
  CreditCard,
  DollarSign,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";
import type { DashboardMetrics, BusinessType } from "@/lib/data-service";

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

export function MetricsCards({ metrics, type }: MetricsCardsProps) {
  const currencyFormatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  });

  const totalRevenue = Number(metrics?.totalRevenue ?? 0);
  const totalExpenses = Number(metrics.operationalExpenses ?? 0);
  const netProfit = Number(metrics.netProfit ?? 0);

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
