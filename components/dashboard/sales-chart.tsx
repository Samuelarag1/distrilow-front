"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { useTransactions } from "@/components/providers/transactions-provider";
import { useBusiness } from "@/components/providers/business-provider";
import { format, subDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

export function SalesChart() {
  const { sales } = useTransactions();
  const { businessType } = useBusiness();

  // Generate chart data for the last 7 days from real transactions
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const daySales = sales.filter(s =>
      s.businessType === businessType &&
      isSameDay(new Date(s.date), date)
    );

    return {
      name: format(date, "EEE", { locale: es }),
      ventas: daySales.reduce((sum, s) => sum + s.amount, 0),
      pedidos: daySales.length
    };
  });

  const chartConfig = {
    ventas: {
      label: "Ventas",
      color: "hsl(var(--chart-1))",
    },
    pedidos: {
      label: "Pedidos",
      color: "hsl(var(--chart-2))",
    },
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">
          Desempeño de Ventas (7 días)
        </CardTitle>
        <CardDescription className="text-sm">
          Basado en transacciones reales del sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="w-full h-[250px] sm:h-[300px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                  width={45}
                />
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
  );
}
