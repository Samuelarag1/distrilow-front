"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, DollarSign, ShoppingCart } from "lucide-react"

interface Sale {
  id: string
  time: string
  customer: string
  items: number
  total: number
  method: "cash" | "card"
  status: "completed" | "pending" | "cancelled"
}

const todaySales: Sale[] = [
  {
    id: "V001",
    time: "14:30",
    customer: "Mesa 5",
    items: 3,
    total: 45.5,
    method: "card",
    status: "completed",
  },
  {
    id: "V002",
    time: "14:15",
    customer: "María García",
    items: 2,
    total: 28.75,
    method: "cash",
    status: "completed",
  },
  {
    id: "V003",
    time: "13:45",
    customer: "Mesa 2",
    items: 4,
    total: 67.2,
    method: "card",
    status: "completed",
  },
  {
    id: "V004",
    time: "13:30",
    customer: "Carlos López",
    items: 1,
    total: 15.0,
    method: "cash",
    status: "completed",
  },
  {
    id: "V005",
    time: "13:00",
    customer: "Mesa 8",
    items: 5,
    total: 89.25,
    method: "card",
    status: "completed",
  },
  {
    id: "V006",
    time: "12:45",
    customer: "Ana Martín",
    items: 2,
    total: 32.5,
    method: "cash",
    status: "completed",
  },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800"
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "cancelled":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

const getMethodIcon = (method: string) => {
  return method === "card" ? "💳" : "💵"
}

export function DailySales() {
  const totalSales = todaySales.reduce((sum, sale) => sum + sale.total, 0)
  const totalOrders = todaySales.length
  const avgOrder = totalSales / totalOrders

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
            <div className="space-y-3">
              {todaySales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-sm font-medium">{sale.time}</p>
                      <p className="text-xs text-muted-foreground">#{sale.id}</p>
                    </div>
                    <div>
                      <p className="font-medium">{sale.customer}</p>
                      <p className="text-sm text-muted-foreground">{sale.items} productos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold">${sale.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {getMethodIcon(sale.method)} {sale.method}
                      </p>
                    </div>
                    <Badge className={getStatusColor(sale.status)}>
                      {sale.status === "completed"
                        ? "Completado"
                        : sale.status === "pending"
                          ? "Pendiente"
                          : "Cancelado"}
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
              <p className="text-sm text-muted-foreground">Total del Día</p>
              <p className="text-3xl font-bold text-green-600">${totalSales.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <ShoppingCart className="h-8 w-8 mx-auto text-blue-500" />
              <p className="text-sm text-muted-foreground">Órdenes Completadas</p>
              <p className="text-3xl font-bold text-blue-600">{totalOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <div className="h-8 w-8 mx-auto bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold">Ø</span>
              </div>
              <p className="text-sm text-muted-foreground">Ticket Promedio</p>
              <p className="text-3xl font-bold text-purple-600">${avgOrder.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
