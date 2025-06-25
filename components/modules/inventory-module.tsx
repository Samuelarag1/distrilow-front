"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Package,
  TrendingDown,
  TrendingUp,
  Search,
  Plus,
  Minus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  cost: number;
  lastUpdated: string;
}
const mockInventory: InventoryItem[] = [
  {
    id: "1",
    name: "Cerveza Rubia",
    category: "Cervezas",
    currentStock: 30,
    minStock: 10,
    maxStock: 100,
    unit: "botellas",
    cost: 2500,
    lastUpdated: "2025-06-01",
  },
  {
    id: "2",
    name: "Vino Tinto",
    category: "Vinos",
    currentStock: 20,
    minStock: 8,
    maxStock: 50,
    unit: "botellas",
    cost: 9000,
    lastUpdated: "2025-06-03",
  },
  {
    id: "3",
    name: "Fernet Branca",
    category: "Tragos",
    currentStock: 10,
    minStock: 5,
    maxStock: 30,
    unit: "botellas",
    cost: 7000,
    lastUpdated: "2025-06-02",
  },
  {
    id: "4",
    name: "Vodka",
    category: "Destilados",
    currentStock: 2,
    minStock: 6,
    maxStock: 25,
    unit: "botellas",
    cost: 7000,
    lastUpdated: "2025-06-04",
  },
  {
    id: "5",
    name: "Gin Tonic",
    category: "Tragos",
    currentStock: 18,
    minStock: 10,
    maxStock: 40,
    unit: "tragos",
    cost: 5000,
    lastUpdated: "2025-06-05",
  },
  {
    id: "6",
    name: "Whisky",
    category: "Destilados",
    currentStock: 9,
    minStock: 4,
    maxStock: 20,
    unit: "botellas",
    cost: 9000,
    lastUpdated: "2025-06-01",
  },
];

export function InventoryModule() {
  const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { toast } = useToast();

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(
    new Set(inventory.map((item) => item.category))
  );
  const lowStockItems = inventory.filter(
    (item) => item.currentStock <= item.minStock
  );
  const totalValue = inventory.reduce(
    (sum, item) => sum + item.currentStock * item.cost,
    0
  );

  const updateStock = (id: string, change: number) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStock = Math.max(0, item.currentStock + change);
          return {
            ...item,
            currentStock: newStock,
            lastUpdated: new Date().toISOString().split("T")[0],
          };
        }
        return item;
      })
    );

    toast({
      title: "Stock actualizado",
      description: `Stock ${
        change > 0 ? "aumentado" : "reducido"
      } correctamente`,
    });
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock <= item.minStock) return "low";
    if (item.currentStock >= item.maxStock * 0.8) return "high";
    return "normal";
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case "low":
        return "text-red-500";
      case "high":
        return "text-green-500";
      default:
        return "text-blue-500";
    }
  };

  const getProgressValue = (item: InventoryItem) => {
    return (item.currentStock / item.maxStock) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Control de Inventario
          </h1>
          <p className="text-muted-foreground">
            Gestiona el stock de tus productos
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Productos
                </p>
                <p className="text-2xl font-bold">{inventory.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Stock Bajo
                </p>
                <p className="text-2xl font-bold text-red-500">
                  {lowStockItems.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Valor Total
                </p>
                <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Categorías
                </p>
                <p className="text-2xl font-bold">{categories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Alerta de Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm font-medium">{item.name}</span>
                  <Badge variant="destructive">
                    {item.currentStock} {item.unit}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInventory.map((item) => {
              const status = getStockStatus(item);
              const progressValue = getProgressValue(item);

              return (
                <Card key={item.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{item.name}</h3>
                        <Badge variant="outline">{item.category}</Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>Stock actual:</span>
                          <span
                            className={`font-medium ${getStockColor(status)}`}
                          >
                            {item.currentStock} {item.unit}
                          </span>
                        </div>
                        <Progress value={progressValue} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Min: {item.minStock}</span>
                          <span>Max: {item.maxStock}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span>Costo unitario: ${item.cost.toFixed(2)}</span>
                        <span>
                          Valor total: $
                          {(item.currentStock * item.cost).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStock(item.id, -1)}
                        disabled={item.currentStock <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStock(item.id, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredInventory.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No se encontraron productos
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
