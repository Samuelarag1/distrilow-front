"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

const data = [
  { name: "Ene", ventas: 4000, pedidos: 240 },
  { name: "Feb", ventas: 3000, pedidos: 139 },
  { name: "Mar", ventas: 2000, pedidos: 980 },
  { name: "Abr", ventas: 2780, pedidos: 390 },
  { name: "May", ventas: 1890, pedidos: 480 },
  { name: "Jun", ventas: 2390, pedidos: 380 },
  { name: "Jul", ventas: 3490, pedidos: 430 },
]

const chartConfig = {
  ventas: {
    label: "Ventas",
    color: "hsl(var(--chart-1))",
  },
  pedidos: {
    label: "Pedidos",
    color: "hsl(var(--chart-2))",
  },
}

export function SalesChart() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Resumen de Ventas</CardTitle>
        <CardDescription>Ventas y pedidos de los últimos 7 meses</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="w-full h-[300px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={60} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  stackId="1"
                  stroke="var(--color-ventas)"
                  fill="var(--color-ventas)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="pedidos"
                  stackId="1"
                  stroke="var(--color-pedidos)"
                  fill="var(--color-pedidos)"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
