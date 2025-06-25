"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Bar, BarChart } from "recharts"

interface SalesChartProps {
  period: "monthly" | "quarterly" | "yearly"
}

const monthlyData = [
  { name: "Ene", ventas: 45230, pedidos: 342, clientes: 287 },
  { name: "Feb", ventas: 52100, pedidos: 398, clientes: 324 },
  { name: "Mar", ventas: 48750, pedidos: 365, clientes: 298 },
  { name: "Abr", ventas: 56200, pedidos: 421, clientes: 356 },
  { name: "May", ventas: 61500, pedidos: 467, clientes: 389 },
  { name: "Jun", ventas: 58900, pedidos: 445, clientes: 372 },
  { name: "Jul", ventas: 64300, pedidos: 489, clientes: 401 },
  { name: "Ago", ventas: 67800, pedidos: 512, clientes: 425 },
  { name: "Sep", ventas: 63200, pedidos: 478, clientes: 398 },
  { name: "Oct", ventas: 69500, pedidos: 523, clientes: 441 },
  { name: "Nov", ventas: 72100, pedidos: 548, clientes: 467 },
  { name: "Dic", ventas: 78900, pedidos: 592, clientes: 501 },
]

const quarterlyData = [
  { name: "Q1 2023", ventas: 142080, pedidos: 1105, clientes: 909 },
  { name: "Q2 2023", ventas: 176600, pedidos: 1333, clientes: 1117 },
  { name: "Q3 2023", ventas: 195300, pedidos: 1479, clientes: 1224 },
  { name: "Q4 2023", ventas: 220500, pedidos: 1663, clientes: 1409 },
  { name: "Q1 2024", ventas: 146080, pedidos: 1105, clientes: 909 },
  { name: "Q2 2024", ventas: 176600, pedidos: 1333, clientes: 1117 },
  { name: "Q3 2024", ventas: 195300, pedidos: 1479, clientes: 1224 },
  { name: "Q4 2024", ventas: 220500, pedidos: 1663, clientes: 1409 },
]

const yearlyData = [
  { name: "2020", ventas: 520000, pedidos: 4200, clientes: 3500 },
  { name: "2021", ventas: 680000, pedidos: 5100, clientes: 4200 },
  { name: "2022", ventas: 750000, pedidos: 5800, clientes: 4800 },
  { name: "2023", ventas: 834480, pedidos: 6580, clientes: 5659 },
  { name: "2024", ventas: 738480, pedidos: 5880, clientes: 5159 },
]

const chartConfig = {
  ventas: {
    label: "Ventas ($)",
    color: "hsl(var(--chart-1))",
  },
  pedidos: {
    label: "Pedidos",
    color: "hsl(var(--chart-2))",
  },
  clientes: {
    label: "Clientes",
    color: "hsl(var(--chart-3))",
  },
}

export function SalesChart({ period }: SalesChartProps) {
  const getData = () => {
    switch (period) {
      case "monthly":
        return monthlyData
      case "quarterly":
        return quarterlyData
      case "yearly":
        return yearlyData
      default:
        return monthlyData
    }
  }

  const getTitle = () => {
    switch (period) {
      case "monthly":
        return "Evolución Mensual"
      case "quarterly":
        return "Evolución Trimestral"
      case "yearly":
        return "Evolución Anual"
      default:
        return "Evolución de Ventas"
    }
  }

  const data = getData()

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{getTitle()} - Ventas</CardTitle>
          <CardDescription>
            Tendencia de ingresos por {period === "monthly" ? "mes" : period === "quarterly" ? "trimestre" : "año"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[300px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="var(--color-ventas)"
                    strokeWidth={3}
                    dot={{ fill: "var(--color-ventas)", strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{getTitle()} - Pedidos y Clientes</CardTitle>
          <CardDescription>
            Volumen de operaciones por {period === "monthly" ? "mes" : period === "quarterly" ? "trimestre" : "año"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[300px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="pedidos" fill="var(--color-pedidos)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="clientes" fill="var(--color-clientes)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
