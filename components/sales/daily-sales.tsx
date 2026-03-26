"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Landmark, ShoppingCart, Target, Wallet } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useTransactions } from "@/components/providers/transactions-provider";
import { useUser } from "@/components/providers/user-provider";

const chartConfig = {
  ventas: {
    label: "Ventas ($)",
    color: "hsl(var(--chart-1))",
  },
};

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  });
}

export function DailySales() {
  const { sales, isLoading } = useTransactions();
  const { branchId } = useUser();

  const dailyTrend = (() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const start = new Date(today);
    start.setDate(today.getDate() - 13);
    start.setHours(0, 0, 0, 0);

    const totalsByDate = new Map<string, number>();

    sales.forEach((sale) => {
      if (branchId && sale.branchId && sale.branchId !== branchId) return;
      if (sale.lifecycleStatus === "CANCELLED") return;

      const saleDate = new Date(sale.date);
      if (Number.isNaN(saleDate.getTime())) return;
      if (saleDate < start || saleDate > today) return;

      const key = toDateKey(saleDate);
      const current = totalsByDate.get(key) ?? 0;
      totalsByDate.set(key, current + Number(sale.totalAmount ?? sale.amount ?? 0));
    });

    return Array.from({ length: 14 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = toDateKey(date);
      return {
        name: date.toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
        }),
        ventas: Number(totalsByDate.get(key) ?? 0),
      };
    });
  })();

  const todaySales = useMemo(() => {
    const today = new Date();
    return sales
      .filter((sale) => {
        if (branchId && sale.branchId && sale.branchId !== branchId) return false;
        if (sale.lifecycleStatus === "CANCELLED") return false;
        const date = new Date(sale.date);
        return isSameCalendarDay(date, today);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, branchId]);

  const totalSales = todaySales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount ?? sale.amount ?? 0),
    0
  );
  const completedOrders = todaySales.length;
  const avgOrder = completedOrders > 0 ? totalSales / completedOrders : 0;

  const cashIncome = todaySales.reduce((sum, sale) => {
    return sum + Number(sale.paymentBreakdownByMethod.cash ?? 0);
  }, 0);

  const transferIncome = todaySales.reduce((sum, sale) => {
    return sum + Number(sale.paymentBreakdownByMethod.transfer ?? 0);
  }, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Evolucion diaria (ultimos 14 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[280px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailyTrend}
                  margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                >
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
                    activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analisis diario</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="text-sm text-muted-foreground">
              Cargando metricas de hoy...
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <DollarSign className="h-8 w-8 mx-auto text-green-500" />
                  <p className="text-sm text-muted-foreground">Total del dia</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${formatMoney(totalSales)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <ShoppingCart className="h-8 w-8 mx-auto text-blue-500" />
                  <p className="text-sm text-muted-foreground">
                    Ordenes completadas
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {completedOrders}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <Target className="h-8 w-8 mx-auto text-purple-500" />
                  <p className="text-sm text-muted-foreground">Ticket promedio</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${formatMoney(avgOrder)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <Wallet className="h-8 w-8 mx-auto text-emerald-500" />
                  <p className="text-sm text-muted-foreground">Ingreso efectivo</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    ${formatMoney(cashIncome)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <Landmark className="h-8 w-8 mx-auto text-sky-500" />
                  <p className="text-sm text-muted-foreground">
                    Ingreso transferencia
                  </p>
                  <p className="text-2xl font-bold text-sky-600">
                    ${formatMoney(transferIncome)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            El detalle de cada venta se consulta en Historial de Ventas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
