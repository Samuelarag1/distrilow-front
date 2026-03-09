"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, ShoppingCart } from "lucide-react";
import { useTransactions } from "@/components/providers/transactions-provider";

const getStatusColor = (status: string) => {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "partial":
      return "bg-orange-100 text-orange-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function DailySales() {
  const { sales, isLoading } = useTransactions();

  const todaySales = useMemo(() => {
    const today = new Date();
    return sales
      .filter((sale) => {
        const date = new Date(sale.date);
        return (
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate()
        );
      })
      .map((sale) => ({
        id: sale.id,
        time: new Date(sale.date).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        customer: sale.customerName || "Consumidor Final",
        items: sale.items,
        total: sale.totalAmount ?? sale.amount,
        method:
          sale.payments.length > 0
            ? sale.payments.map((payment) => payment.method).join(" + ")
            : "Sin pago",
        status:
          sale.lifecycleStatus === "CANCELLED"
            ? "cancelled"
            : sale.chargeStatus === "PAID"
            ? "paid"
            : sale.chargeStatus === "PARTIALLY_PAID"
            ? "partial"
            : "pending",
      }))
      .sort((a, b) => (a.time < b.time ? 1 : -1));
  }, [sales]);

  const totalSales = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const totalOrders = todaySales.length;
  const avgOrder = totalOrders > 0 ? totalSales / totalOrders : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Ventas de Hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="text-sm text-muted-foreground">
                Cargando ventas de hoy...
              </div>
            )}
            <div className="space-y-3">
              {todaySales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-sm font-medium">{sale.time}</p>
                    </div>
                    <div>
                      <p className="font-medium">{sale.customer}</p>
                      <p className="text-sm text-muted-foreground">
                        {sale.items} productos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold">${sale.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {sale.method}
                      </p>
                    </div>
                    <Badge className={getStatusColor(sale.status)}>
                      {sale.status === "paid"
                        ? "Pagada"
                        : sale.status === "partial"
                        ? "Parcial"
                        : sale.status === "pending"
                        ? "Pendiente"
                        : "Cancelada"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <DollarSign className="h-8 w-8 mx-auto text-green-500" />
              <p className="text-sm text-muted-foreground">Total del Dia</p>
              <p className="text-3xl font-bold text-green-600">
                ${totalSales.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <ShoppingCart className="h-8 w-8 mx-auto text-blue-500" />
              <p className="text-sm text-muted-foreground">
                Ordenes Completadas
              </p>
              <p className="text-3xl font-bold text-blue-600">{totalOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <div className="h-8 w-8 mx-auto bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold">O</span>
              </div>
              <p className="text-sm text-muted-foreground">Ticket Promedio</p>
              <p className="text-3xl font-bold text-purple-600">
                ${avgOrder.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
