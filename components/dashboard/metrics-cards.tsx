"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package } from "lucide-react"

const metrics = [
  {
    title: "Ventas Totales",
    value: "$12,345",
    change: "+12.5%",
    trend: "up",
    icon: DollarSign,
    description: "vs mes anterior",
  },
  {
    title: "Pedidos",
    value: "156",
    change: "+8.2%",
    trend: "up",
    icon: ShoppingCart,
    description: "este mes",
  },
  {
    title: "Clientes",
    value: "1,234",
    change: "+3.1%",
    trend: "up",
    icon: Users,
    description: "clientes activos",
  },
  {
    title: "Productos",
    value: "89",
    change: "-2.4%",
    trend: "down",
    icon: Package,
    description: "en inventario",
  },
]

export function MetricsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
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
