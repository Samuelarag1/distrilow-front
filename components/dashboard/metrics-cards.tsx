"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package, Wallet, FileText, CreditCard } from "lucide-react"
import { DashboardMetrics, BusinessType } from "@/lib/data-service"

interface MetricsCardsProps {
  metrics: DashboardMetrics
  type: BusinessType
}

export function MetricsCards({ metrics, type }: MetricsCardsProps) {
  const commonMetrics = [
    {
      title: "Ingresos Totales",
      value: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(metrics.totalRevenue),
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      description: "vs mes anterior",
    },
    {
      title: "Pedidos Totales",
      value: metrics.totalOrders.toString(),
      change: "+8.2%",
      trend: "up",
      icon: ShoppingCart,
      description: "este mes",
    },
  ]

  const retailMetrics = [
    {
      title: "Clientes en Local",
      value: metrics.walkInCustomers?.toString() || "0",
      change: "+3.1%",
      trend: "up",
      icon: Users,
      description: "hoy",
    },
    {
      title: "Caja Diaria",
      value: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(metrics.dailyCashbox || 0),
      change: "+2.4%",
      trend: "up",
      icon: Wallet,
      description: "saldo actual",
    },
  ]

  const wholesaleMetrics = [
    {
      title: "Clientes Mayoristas",
      value: metrics.activeCustomers.toString(),
      change: "+1.2%",
      trend: "up",
      icon: Users,
      description: "activos",
    },
    {
      title: "Pedidos Pendientes",
      value: metrics.pendingBulkOrders?.toString() || "0",
      change: "-5%",
      trend: "down",
      icon: FileText,
      description: "por procesar",
    },
    {
      title: "Crédito Utilizado",
      value: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(metrics.creditUtilized || 0),
      change: "+15%",
      trend: "up",
      icon: CreditCard,
      description: "cuenta corriente",
    },
  ]

  const specificMetrics = type === "retail" ? retailMetrics : wholesaleMetrics
  
  // Combine: Common + Specific + Stock (Common)
  const displayMetrics = [
    ...commonMetrics,
    ...specificMetrics,
    {
        title: "Bajo Stock",
        value: metrics.lowStockItems.toString(),
        change: metrics.lowStockItems > 10 ? "Alerta" : "Normal",
        trend: metrics.lowStockItems > 10 ? "down" : "up",
        icon: Package,
        description: "productos",
    }
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {displayMetrics.map((metric) => {
        const Icon = metric.icon
        const TrendIcon = metric.trend === "up" ? TrendingUp : TrendingDown

        return (
          <Card key={metric.title} className="transition-all hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.title}</CardTitle>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center text-xs">
                <TrendIcon className={`mr-1 h-3 w-3 ${metric.trend === "up" ? "text-green-500" : "text-red-500"}`} />
                <span className={`font-medium ${metric.trend === "up" ? "text-green-500" : "text-red-500"}`}>
                  {metric.change}
                </span>
                <span className="text-muted-foreground ml-1">{metric.description}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
