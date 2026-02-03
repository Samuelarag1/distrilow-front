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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProducts, Product } from "@/components/providers/product-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type SortKey = "name" | "stock" | "category" | "price";
type SortOrder = "asc" | "desc";

const CATEGORY_COLORS: Record<string, string> = {
  Cervezas: "bg-amber-100 text-amber-700 border-amber-200",
  Vinos: "bg-purple-100 text-purple-700 border-purple-200",
  Tragos: "bg-pink-100 text-pink-700 border-pink-200",
  Destilados: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Comida: "bg-orange-100 text-orange-700 border-orange-200",
  Otros: "bg-slate-100 text-slate-700 border-slate-200",
};

const getCategoryColor = (category: string) => {
  return CATEGORY_COLORS[category] || "bg-blue-100 text-blue-700 border-blue-200";
};

function AddStockDialog({ item, onAdd }: { item: Product, onAdd: (amount: number) => void }) {
  const [amount, setAmount] = useState<string>("");
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(amount);
    if (!isNaN(val) && val > 0) {
      onAdd(val);
      setAmount("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-10 px-4 bg-primary hover:bg-primary/90 shadow-md transition-all font-bold group"
        >
          <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" />
          Sumar Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Actualizar Stock
            </DialogTitle>
            <DialogDescription>
              Ingresa la cantidad que deseas <strong>sumar</strong> a las existencias actuales de <strong>{item.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-bold uppercase">Stock Actual</p>
                <p className="text-2xl font-black">{item.stock} {item.unit || 'uds'}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs text-muted-foreground font-bold uppercase">Nuevo Total</p>
                <p className="text-2xl font-black text-primary">
                  {item.stock + (parseInt(amount) || 0)} {item.unit || 'uds'}
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount" className="font-bold">Cantidad a agregar</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Ej: 50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className="text-lg font-bold h-12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="font-bold"
            >
              Cancelar
            </Button>
            <Button type="submit" className="font-bold px-8">
              Confirmar Ingreso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryModule() {
  const { products: inventory, adjustStock, updateStock: setStockValue } = useProducts();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const { toast } = useToast();

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const filteredInventory = inventory
    .filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const factor = sortOrder === "asc" ? 1 : -1;
      const valA = a[sortKey] || 0;
      const valB = b[sortKey] || 0;
      if (valA < valB) return -1 * factor;
      if (valA > valB) return 1 * factor;
      return 0;
    });

  const categories = Array.from(
    new Set(inventory.map((item) => item.category))
  );

  const lowStockItems = inventory.filter(
    (item) => item.stock <= (item.minStock || 0)
  );

  const totalValue = inventory.reduce(
    (sum, item) => sum + item.stock * item.price,
    0
  );

  const getStockStatus = (item: Product) => {
    if (item.stock <= (item.minStock || 0)) return "low";
    if (item.stock >= (item.maxStock || 100) * 0.8) return "high";
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

  const getProgressValue = (item: Product) => {
    const max = item.maxStock || 100;
    return (item.stock / max) * 100;
  };

  function InventoryItemCard({ item }: { item: Product }) {
    const status = getStockStatus(item);
    const progressValue = getProgressValue(item);

    const handleAddStock = (amountToAdd: number) => {
      adjustStock(item.id, amountToAdd);
      toast({
        title: "Stock Incrementado",
        description: `Se han sumado ${amountToAdd} ${item.unit || 'unidades'} a ${item.name}.`,
      });
    };

    return (
      <Card
        className="w-full p-4 transition-all hover:shadow-lg border-l-4 group relative overflow-hidden"
        style={{
          borderLeftColor:
            status === "low"
              ? "#ef4444"
              : status === "high"
                ? "#22c55e"
                : "#3b82f6",
        }}
      >
        {status === "low" && (
          <div className="absolute top-0 right-0 p-1 bg-red-500 text-white transform rotate-0 text-[8px] font-black uppercase px-2 rounded-bl-lg">
            Reposición Urgente
          </div>
        )}
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Item Info */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${status === 'low' ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                  <Package className={`h-6 w-6 ${status === 'low' ? 'text-red-500' : 'text-primary'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight truncate group-hover:text-primary transition-colors">
                    {item.name}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-black tracking-widest mt-1 ${getCategoryColor(item.category)}`}
                  >
                    {item.category}
                  </Badge>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className={`text-3xl font-black leading-none ${getStockColor(status)}`}>
                  {item.stock}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mt-1">
                  {item.unit || "unidades"} disponibles
                </div>
              </div>
            </div>

            <div className="space-y-1.5 mt-4">
              <Progress value={progressValue} className={`h-2 ${status === 'low' ? 'bg-red-100' : 'bg-secondary'}`} />
              <div className="flex justify-between text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                <span className={status === 'low' ? 'text-red-500' : ''}>Mín: {item.minStock || 0}</span>
                <span>Capacidad: {item.maxStock || 100}</span>
              </div>
            </div>
          </div>

          {/* Pricing & Valorization */}
          <div className="hidden lg:flex flex-col items-end justify-center px-8 border-l border-dashed min-w-[180px]">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Valorización</span>
              <span className="text-xl font-black text-primary">${(item.stock * item.price).toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground font-medium italic mt-0.5">
                (Calc. a ${item.price}/u)
              </span>
            </div>
          </div>

          {/* New Control Flow */}
          <div className="flex items-center gap-3 w-full md:w-auto md:pl-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0">
            <AddStockDialog item={item} onAdd={handleAddStock} />
          </div>
        </div>
      </Card>
    );
  }

  function SortButton({ label, sortKey: key }: { label: string, sortKey: SortKey }) {
    const isActive = sortKey === key;
    return (
      <Button
        variant={isActive ? "secondary" : "ghost"}
        size="sm"
        className="h-8 text-xs font-medium"
        onClick={() => handleSort(key)}
      >
        {label}
        {isActive ? (
          sortOrder === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
        ) : (
          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
        )}
      </Button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Control de Inventario
          </h1>
          <p className="text-muted-foreground">
            Gestión inteligente de existencias y valorización
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-b-4 border-b-blue-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Productos</p>
                <p className="text-3xl font-bold mt-1">{inventory.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-b-4 border-b-red-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stock Bajo</p>
                <p className="text-3xl font-bold mt-1 text-red-500">{lowStockItems.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-b-4 border-b-green-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                <p className="text-3xl font-bold mt-1">${totalValue.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-b-4 border-b-orange-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categorías</p>
                <p className="text-3xl font-bold mt-1">{categories.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos por nombre..."
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

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-sm text-muted-foreground font-medium mr-2">Ordenar por:</span>
              <SortButton label="Nombre" sortKey="name" />
              <SortButton label="Stock" sortKey="stock" />
              <SortButton label="Categoría" sortKey="category" />
              <SortButton label="Precio" sortKey="price" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {filteredInventory.map((item) => (
              <InventoryItemCard
                key={item.id}
                item={item}
              />
            ))}
          </div>

          {filteredInventory.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No se encontraron productos con los filtros aplicados
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
