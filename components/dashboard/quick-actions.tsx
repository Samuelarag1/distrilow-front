"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, FileText, Users, Package, Calendar, TrendingUp } from "lucide-react"

const actions = [
  {
    title: "Nuevo Producto",
    description: "Agregar producto al catálogo",
    icon: Plus,
    color: "bg-blue-500 hover:bg-blue-600",
  },
  {
    title: "Ver Reportes",
    description: "Generar reportes de ventas",
    icon: FileText,
    color: "bg-green-500 hover:bg-green-600",
  },
  {
    title: "Gestionar Clientes",
    description: "Ver y editar clientes",
    icon: Users,
    color: "bg-purple-500 hover:bg-purple-600",
  },
  {
    title: "Control de Stock",
    description: "Revisar inventario",
    icon: Package,
    color: "bg-orange-500 hover:bg-orange-600",
  },
  {
    title: "Programar Cita",
    description: "Nueva cita o reserva",
    icon: Calendar,
    color: "bg-pink-500 hover:bg-pink-600",
  },
  {
    title: "Análisis",
    description: "Ver métricas detalladas",
    icon: TrendingUp,
    color: "bg-indigo-500 hover:bg-indigo-600",
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones Rápidas</CardTitle>
        <CardDescription>Accesos directos a las funciones más utilizadas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.title}
                variant="outline"
                className="h-auto p-4 flex flex-col items-start space-y-2 hover:shadow-md transition-all"
              >
                <div className={`p-2 rounded-md text-white ${action.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="font-medium">{action.title}</div>
                  <div className="text-sm text-muted-foreground">{action.description}</div>
                </div>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
