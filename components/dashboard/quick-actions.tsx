"use client"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, FileText, Users, Package, TrendingUp, DollarSign } from "lucide-react"
import { AddExpenseDialog } from "./add-expense-dialog"

export function QuickActions() {
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)

  const actions = [
    {
      title: "Registrar Gasto",
      description: "Agregar nuevo egreso",
      icon: DollarSign,
      color: "bg-red-500 hover:bg-red-600",
      action: () => setIsExpenseDialogOpen(true),
    },
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
      title: "Análisis",
      description: "Ver métricas detalladas",
      icon: TrendingUp,
      color: "bg-indigo-500 hover:bg-indigo-600",
    },
  ]

  return (
    <>
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
                  onClick={action.action}
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

      <AddExpenseDialog
        open={isExpenseDialogOpen}
        onOpenChange={setIsExpenseDialogOpen}
      />
    </>
  )
}
