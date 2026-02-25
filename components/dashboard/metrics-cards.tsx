"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Wallet,
  FileText,
  CreditCard,
  Receipt,
  PiggyBank,
} from "lucide-react";
import { DashboardMetrics, BusinessType } from "@/lib/data-service";
import { useTransactions } from "@/components/providers/transactions-provider";
import { useProducts } from "@/hooks/useProducts";

interface MetricsCardsProps {
  metrics: DashboardMetrics;
  type: BusinessType;
}

export function MetricsCards({ metrics, type }: MetricsCardsProps) {
  const { getTotalExpensesByType } = useTransactions();
  const { products } = useProducts();

  const totalExpenses = getTotalExpensesByType(type);
  const netProfit = metrics.totalRevenue - totalExpenses;

  // const lowStockCount = products.filter(p => p.stock <= (p.minStock || 0)).length

  const commonMetrics = [
    {
      title: "Ingresos Totales",
      value: new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }).format(metrics.totalRevenue),
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      description: "vs mes anterior",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Gastos Operativos",
      value: new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }).format(totalExpenses),
      change: "+5.2%",
      trend: "down",
      icon: Receipt,
      description: "mes actual",
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      title: "Ganancia Neta",
      value: new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }).format(netProfit),
      change: "+8.4%",
      trend: "up",
      icon: PiggyBank,
      description: "margen proyectado",
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    // {
    //   title: "Bajo Stock",
    //   value: lowStockCount.toString(),
    //   change: lowStockCount > 3 ? "¡Atención!" : "Normal",
    //   trend: lowStockCount > 3 ? "down" : "up",
    //   icon: Package,
    //   description: "productos",
    //   color: lowStockCount > 3 ? "text-red-600" : "text-orange-500",
    //   bg: "bg-orange-500/10",
    // },
  ];

  const retailMetrics = [
    {
      title: "Caja Diaria",
      value: new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }).format(metrics.dailyCashbox || 0),
      change: "+2.4%",
      trend: "up",
      icon: Wallet,
      description: "saldo actual",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  const wholesaleMetrics = [
    {
      title: "Crédito Utilizado",
      value: new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }).format(metrics.creditUtilized || 0),
      change: "+15%",
      trend: "up",
      icon: CreditCard,
      description: "cuenta corriente",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
  ];

  const specificMetrics = type === "retail" ? retailMetrics : wholesaleMetrics;

  // Combine all metrics
  const displayMetrics = [...commonMetrics, ...specificMetrics];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {displayMetrics.map((metric) => {
        const Icon = metric.icon;
        const TrendIcon = metric.trend === "up" ? TrendingUp : TrendingDown;
        const iconColor = metric.color || "text-primary";
        const iconBg = metric.bg || "bg-primary/10";

        return (
          <Card
            key={metric.title}
            className="transition-all hover:shadow-md cursor-pointer border-l-4 hover:-translate-y-1 duration-200"
            style={{
              borderLeftColor: metric.trend === "up" ? "#22c55e" : "#ef4444",
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div
                className={`h-8 w-8 rounded-full ${iconBg} flex items-center justify-center`}
              >
                <Icon className={`h-4 w-4 ${iconColor}`} />
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
                <span className="text-muted-foreground ml-1">
                  {metric.description}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
