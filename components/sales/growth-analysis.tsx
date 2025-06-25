"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, Target, Award, Calendar, Users } from "lucide-react"

interface GrowthAnalysisProps {
  period: "monthly" | "quarterly" | "yearly"
}

export function GrowthAnalysis({ period }: GrowthAnalysisProps) {
  const getGrowthData = () => {
    switch (period) {
      case "monthly":
        return {
          salesGrowth: 8.3,
          ordersGrowth: 12.1,
          customersGrowth: 15.7,
          avgOrderGrowth: -2.8,
          target: 75000,
          current: 72100,
          bestMonth: "Diciembre",
          bestValue: 78900,
        }
      case "quarterly":
        return {
          salesGrowth: 12.8,
          ordersGrowth: 15.2,
          customersGrowth: 18.9,
          avgOrderGrowth: -1.5,
          target: 250000,
          current: 220500,
          bestMonth: "Q4 2024",
          bestValue: 220500,
        }
      case "yearly":
        return {
          salesGrowth: -11.5,
          ordersGrowth: -10.6,
          customersGrowth: -8.8,
          avgOrderGrowth: -0.9,
          target: 900000,
          current: 738480,
          bestMonth: "2023",
          bestValue: 834480,
        }
      default:
        return {
          salesGrowth: 8.3,
          ordersGrowth: 12.1,
          customersGrowth: 15.7,
          avgOrderGrowth: -2.8,
          target: 75000,
          current: 72100,
          bestMonth: "Diciembre",
          bestValue: 78900,
        }
    }
  }

  const data = getGrowthData()
  const targetProgress = (data.current / data.target) * 100

  const getPeriodText = () => {
    switch (period) {
      case "monthly":
        return "mes"
      case "quarterly":
        return "trimestre"
      case "yearly":
        return "año"
      default:
        return "período"
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Análisis de Crecimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Crecimiento en Ventas</span>
                  <div className="flex items-center gap-1">
                    {data.salesGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={data.salesGrowth >= 0 ? "default" : "destructive"}>
                      {data.salesGrowth >= 0 ? "+" : ""}
                      {data.salesGrowth}%
                    </Badge>
                  </div>
                </div>
                <Progress value={Math.abs(data.salesGrowth)} className="h-2" />
                <p className="text-xs text-muted-foreground">vs {getPeriodText()} anterior</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Crecimiento en Pedidos</span>
                  <div className="flex items-center gap-1">
                    {data.ordersGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={data.ordersGrowth >= 0 ? "default" : "destructive"}>
                      {data.ordersGrowth >= 0 ? "+" : ""}
                      {data.ordersGrowth}%
                    </Badge>
                  </div>
                </div>
                <Progress value={Math.abs(data.ordersGrowth)} className="h-2" />
                <p className="text-xs text-muted-foreground">vs {getPeriodText()} anterior</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Crecimiento en Clientes</span>
                  <div className="flex items-center gap-1">
                    {data.customersGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={data.customersGrowth >= 0 ? "default" : "destructive"}>
                      {data.customersGrowth >= 0 ? "+" : ""}
                      {data.customersGrowth}%
                    </Badge>
                  </div>
                </div>
                <Progress value={Math.abs(data.customersGrowth)} className="h-2" />
                <p className="text-xs text-muted-foreground">vs {getPeriodText()} anterior</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Ticket Promedio</span>
                  <div className="flex items-center gap-1">
                    {data.avgOrderGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={data.avgOrderGrowth >= 0 ? "default" : "destructive"}>
                      {data.avgOrderGrowth >= 0 ? "+" : ""}
                      {data.avgOrderGrowth}%
                    </Badge>
                  </div>
                </div>
                <Progress value={Math.abs(data.avgOrderGrowth)} className="h-2" />
                <p className="text-xs text-muted-foreground">vs {getPeriodText()} anterior</p>
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
                  ${data.current.toLocaleString()} / ${data.target.toLocaleString()}
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
                  {targetProgress >= 90 ? "¡Excelente!" : targetProgress >= 70 ? "Buen progreso" : "Necesita atención"}
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
                <p className="text-sm text-muted-foreground">Mejor {getPeriodText()}</p>
                <p className="font-bold">{data.bestMonth}</p>
                <p className="text-lg font-bold text-yellow-600">${data.bestValue.toLocaleString()}</p>
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
                <p className="font-bold">{data.salesGrowth >= 0 ? "Crecimiento" : "Decrecimiento"}</p>
                <Badge variant={data.salesGrowth >= 0 ? "default" : "destructive"} className="mt-2">
                  {data.salesGrowth >= 0 ? "Positiva" : "Negativa"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <Users className="h-8 w-8 mx-auto text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Retención de Clientes</p>
                <p className="font-bold">85%</p>
                <p className="text-xs text-muted-foreground mt-1">Clientes recurrentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
