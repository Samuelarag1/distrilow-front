"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Download, Eye } from "lucide-react"

interface SaleRecord {
  id: string
  date: string
  customer: string
  products: string[]
  total: number
  method: "cash" | "card"
  status: "completed" | "pending" | "cancelled"
}

const salesData: SaleRecord[] = [
  {
    id: "V2024001",
    date: "2024-01-15 14:30",
    customer: "María García",
    products: ["Pasta Carbonara", "Coca Cola"],
    total: 22.0,
    method: "card",
    status: "completed",
  },
  {
    id: "V2024002",
    date: "2024-01-15 13:45",
    customer: "Carlos López",
    products: ["Pizza Margherita", "Ensalada César"],
    total: 36.5,
    method: "cash",
    status: "completed",
  },
  {
    id: "V2024003",
    date: "2024-01-15 12:30",
    customer: "Ana Martín",
    products: ["Hamburguesa Clásica"],
    total: 16.0,
    method: "card",
    status: "completed",
  },
  {
    id: "V2024004",
    date: "2024-01-14 19:15",
    customer: "Pedro Ruiz",
    products: ["Pasta Carbonara", "Tiramisu", "Coca Cola"],
    total: 30.5,
    method: "cash",
    status: "completed",
  },
  {
    id: "V2024005",
    date: "2024-01-14 18:00",
    customer: "Laura Sánchez",
    products: ["Pizza Margherita", "Coca Cola"],
    total: 25.5,
    method: "card",
    status: "completed",
  },
]

export function SalesTable() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")

  const filteredSales = salesData.filter((sale) => {
    const matchesSearch =
      sale.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.products.some((product) => product.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = selectedStatus === "all" || sale.status === selectedStatus

    return matchesSearch && matchesStatus
  })

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

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Completado"
      case "pending":
        return "Pendiente"
      case "cancelled":
        return "Cancelado"
      default:
        return "Desconocido"
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle>Historial de Ventas</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, ID o producto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completado</option>
              <option value="pending">Pendiente</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">ID Venta</th>
                    <th className="text-left p-3 font-medium">Fecha</th>
                    <th className="text-left p-3 font-medium">Cliente</th>
                    <th className="text-left p-3 font-medium">Productos</th>
                    <th className="text-left p-3 font-medium">Total</th>
                    <th className="text-left p-3 font-medium">Método</th>
                    <th className="text-left p-3 font-medium">Estado</th>
                    <th className="text-left p-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="border-t hover:bg-muted/25 transition-colors">
                      <td className="p-3 font-mono text-sm">{sale.id}</td>
                      <td className="p-3 text-sm">{new Date(sale.date).toLocaleString()}</td>
                      <td className="p-3 font-medium">{sale.customer}</td>
                      <td className="p-3">
                        <div className="max-w-48">
                          <p className="text-sm truncate">{sale.products.join(", ")}</p>
                          <p className="text-xs text-muted-foreground">{sale.products.length} productos</p>
                        </div>
                      </td>
                      <td className="p-3 font-bold">${sale.total.toFixed(2)}</td>
                      <td className="p-3">
                        <Badge variant="outline">{sale.method === "card" ? "💳 Tarjeta" : "💵 Efectivo"}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={getStatusColor(sale.status)}>{getStatusText(sale.status)}</Badge>
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredSales.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No se encontraron ventas</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
