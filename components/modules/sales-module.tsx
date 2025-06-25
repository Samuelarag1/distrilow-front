"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Target, Download } from "lucide-react"
import { SalesChart } from "@/components/sales/sales-chart"
import { DailySales } from "@/components/sales/daily-sales"
import { SalesTable } from "@/components/sales/sales-table"
import { GrowthAnalysis } from "@/components/sales/growth-analysis"
import { useToast } from "@/hooks/use-toast"

export function SalesModule() {
  const [selectedPeriod, setSelectedPeriod] = useState("monthly")
  const [selectedYear, setSelectedYear] = useState("2024")
  const { toast } = useToast()

  const handleExport = (format: string) => {
    toast({
      title: "Exportando datos",
      description: `Generando reporte de ventas en formato ${format.toUpperCase()}...`,
    })
  }

  // Datos de ejemplo para métricas
  const todayMetrics = {
    sales: 2450.75,
    orders: 18,
    customers: 15,
    avgOrder: 136.15,
    growth: 12.5,
  }

  const monthlyMetrics = {
    sales: 45230.5,
    orders: 342,
    customers: 287,
    avgOrder: 132.25,
    growth: 8.3,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Análisis de Ventas</h1>
          <p className="text-muted-foreground">Seguimiento completo del rendimiento de ventas</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
              <SelectItem value="2022">2022</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

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
                    <p className="text-2xl font-bold">${todayMetrics.sales.toLocaleString()}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      <span className="text-green-500">+{todayMetrics.growth}%</span>
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
                    <p className="text-sm font-medium text-muted-foreground">Pedidos Hoy</p>
                    <p className="text-2xl font-bold">{todayMetrics.orders}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingUp className="mr-1 h-3 w-3 text-blue-500" />
                      <span className="text-blue-500">+15%</span>
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
                    <p className="text-sm font-medium text-muted-foreground">Clientes Hoy</p>
                    <p className="text-2xl font-bold">{todayMetrics.customers}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingUp className="mr-1 h-3 w-3 text-purple-500" />
                      <span className="text-purple-500">+8%</span>
                      <span className="text-muted-foreground ml-1">vs ayer</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Users className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ticket Promedio</p>
                    <p className="text-2xl font-bold">${todayMetrics.avgOrder.toFixed(2)}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      <span className="text-orange-500">-2%</span>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ventas del Mes</p>
                    <p className="text-2xl font-bold">${monthlyMetrics.sales.toLocaleString()}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      <span className="text-green-500">+{monthlyMetrics.growth}%</span>
                      <span className="text-muted-foreground ml-1">vs mes anterior</span>
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
                    <p className="text-sm font-medium text-muted-foreground">Pedidos del Mes</p>
                    <p className="text-2xl font-bold">{monthlyMetrics.orders}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingUp className="mr-1 h-3 w-3 text-blue-500" />
                      <span className="text-blue-500">+12%</span>
                      <span className="text-muted-foreground ml-1">vs mes anterior</span>
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
                    <p className="text-sm font-medium text-muted-foreground">Clientes del Mes</p>
                    <p className="text-2xl font-bold">{monthlyMetrics.customers}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingUp className="mr-1 h-3 w-3 text-purple-500" />
                      <span className="text-purple-500">+18%</span>
                      <span className="text-muted-foreground ml-1">vs mes anterior</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Users className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ticket Promedio</p>
                    <p className="text-2xl font-bold">${monthlyMetrics.avgOrder.toFixed(2)}</p>
                    <div className="flex items-center text-xs mt-1">
                      <TrendingDown className="mr-1 h-3 w-3 text-orange-500" />
                      <span className="text-orange-500">-3%</span>
                      <span className="text-muted-foreground ml-1">vs mes anterior</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                    <Target className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <SalesChart period="monthly" />
          <GrowthAnalysis period="monthly" />
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
  )
}
