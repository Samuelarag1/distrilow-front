"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Download, Eye } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

import { useTransactions } from "@/components/providers/transactions-provider"
import { useBusiness } from "@/components/providers/business-provider"

export function SalesTable() {
  const { sales, isLoading } = useTransactions()
  const { businessType } = useBusiness()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")

  const filteredSales = sales.filter((sale) => {
    if (sale.businessType !== businessType) return false

    const matchesSearch =
      sale.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.id.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  })

  const getStatusColor = (status?: string) => {
    if (status === 'PENDING') return "bg-yellow-100 text-yellow-800"
    if (status === 'CANCELLED') return "bg-red-100 text-red-800"
    return "bg-green-100 text-green-800"
  }

  const getStatusText = (status?: string) => {
    if (status === 'PENDING') return "Pendiente Sync"
    if (status === 'CANCELLED') return "Cancelado"
    return "Completado"
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
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="p-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="p-3"><Skeleton className="h-4 w-40" /></td>
                        <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="p-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="p-3"><Skeleton className="h-6 w-20" /></td>
                        <td className="p-3"><Skeleton className="h-6 w-24" /></td>
                        <td className="p-3"><Skeleton className="h-8 w-8" /></td>
                      </tr>
                    ))
                  ) : filteredSales.map((sale) => (
                    <tr key={sale.id} className="border-t hover:bg-muted/25 transition-colors">
                      <td className="p-3 font-mono text-sm">{sale.id}</td>
                      <td className="p-3 text-sm">{new Date(sale.date).toLocaleString()}</td>
                      <td className="p-3 font-medium">{sale.customerName}</td>
                      <td className="p-3">
                        <div className="max-w-48">
                          <p className="text-sm truncate">{sale.items} productos</p>
                          <p className="text-xs text-muted-foreground">Vendido por {sale.userName}</p>
                        </div>
                      </td>
                      <td className="p-3 font-bold">${sale.amount.toLocaleString()}</td>
                      <td className="p-3">
                        <Badge variant="outline">💳 Tarjeta</Badge>
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
