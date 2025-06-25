"use client"

import type React from "react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Bell, Search, Moon, Sun, Filter, Download } from "lucide-react"
import { useTheme } from "next-themes"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

export function Header() {
  const { setTheme, theme } = useTheme()
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      toast({
        title: "Búsqueda realizada",
        description: `Buscando: "${searchQuery}"`,
      })
    }
  }

  const handleExport = (format: string) => {
    toast({
      title: "Exportando datos",
      description: `Generando archivo ${format.toUpperCase()}...`,
    })
  }

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="-ml-1 md:hidden" />

      <div className="flex flex-1 items-center gap-2 px-3">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Buscar productos, clientes, pedidos..."
            className="pl-8 pr-4 h-10 w-full bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-ring"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Filter className="h-4 w-4" />
          <span className="sr-only">Filtros</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Download className="h-4 w-4" />
              <span className="sr-only">Exportar</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("csv")}>Exportar CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("pdf")}>Exportar PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("excel")}>Exportar Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                3
              </Badge>
              <span className="sr-only">Notificaciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="p-2">
              <h4 className="font-semibold text-sm mb-2">Notificaciones</h4>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-3">
              <div className="flex flex-col gap-1 w-full">
                <p className="text-sm font-medium">Nuevo pedido recibido</p>
                <p className="text-xs text-muted-foreground">Mesa 5 - $45.50 • hace 5 min</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3">
              <div className="flex flex-col gap-1 w-full">
                <p className="text-sm font-medium">Stock bajo</p>
                <p className="text-xs text-muted-foreground">Quedan 3 unidades de Pasta Carbonara • hace 15 min</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3">
              <div className="flex flex-col gap-1 w-full">
                <p className="text-sm font-medium">Nueva reserva</p>
                <p className="text-xs text-muted-foreground">Juan Pérez - 20:00 para 4 personas • hace 30 min</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </div>
    </header>
  )
}
