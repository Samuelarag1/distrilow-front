"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/components/providers/user-provider";
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
import { Product } from "@/lib/products";
import { useProducts } from "@/components/providers/product-provider";
import useSWR from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";
import type { MovementType } from "@/lib/api-types";

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
  return (
    CATEGORY_COLORS[category] || "bg-blue-100 text-blue-700 border-blue-200"
  );
};

type Category = {
  id: string;
  name: string;
  isActive: boolean;
};

function getLooseCategoryLabel(category: unknown): string {
  if (typeof category === "string" && category.trim()) return category;
  if (category && typeof category === "object") {
    const value = category as { name?: unknown; id?: unknown };
    if (typeof value.name === "string" && value.name.trim()) return value.name;
    if (typeof value.id === "string" && value.id.trim()) return value.id;
  }
  return "Sin categoria";
}

function getLooseCategoryValue(category: unknown): string {
  if (typeof category === "string" && category.trim()) return category;
  if (category && typeof category === "object") {
    const value = category as { id?: unknown; name?: unknown };
    if (typeof value.id === "string" && value.id.trim()) return value.id;
    if (typeof value.name === "string" && value.name.trim()) return value.name;
  }
  return "uncategorized";
}

function AdjustStockDialog({
  item,
  branches,
  onSubmitMovement,
}: {
  item: Product;
  branches: Array<{ id: string; name: string }>;
  onSubmitMovement: (input: {
    type: MovementType;
    quantity: number;
    direction?: "in" | "out";
    reason?: string;
    toBranchId?: string;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState<string>("");
  const [operation, setOperation] = useState<
    "adjust_in" | "adjust_out" | "loss" | "expired" | "transfer"
  >("adjust_in");
  const [toBranchId, setToBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const quantity = Math.abs(Math.trunc(Number(amount)));
    if (!quantity || quantity < 1) return;

    if (operation === "transfer" && !toBranchId) return;

    const map: Record<
      typeof operation,
      { type: MovementType; direction?: "in" | "out" }
    > = {
      adjust_in: { type: "ADJUSTMENT", direction: "in" },
      adjust_out: { type: "ADJUSTMENT", direction: "out" },
      loss: { type: "LOSS" },
      expired: { type: "EXPIRED" },
      transfer: { type: "TRANSFER_OUT" },
    };

    try {
      setIsSubmitting(true);
      const payload = map[operation];
      await onSubmitMovement({
        type: payload.type,
        direction: payload.direction,
        quantity,
        reason: reason.trim() || undefined,
        toBranchId: operation === "transfer" ? toBranchId : undefined,
      });

      setAmount("");
      setReason("");
      setToBranchId("");
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const outgoing = operation === "adjust_out" || operation === "loss" || operation === "expired" || operation === "transfer";
  const currentTotal =
    outgoing
      ? Math.max(0, item.stock - (parseInt(amount) || 0))
      : item.stock + (parseInt(amount) || 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-10 px-4 shadow-md transition-all font-bold group gap-2"
        >
          <History className="h-4 w-4" />
          Ajustar Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Ajuste de Existencias
            </DialogTitle>
            <DialogDescription>
              Modifica el stock actual de <strong>{item.name}</strong>{" "}
              seleccionando el tipo de movimiento y motivo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="space-y-2">
              <Label className="font-bold text-sm">Operacion</Label>
              <select
                value={operation}
                onChange={(e) =>
                  setOperation(
                    e.target.value as
                      | "adjust_in"
                      | "adjust_out"
                      | "loss"
                      | "expired"
                      | "transfer"
                  )
                }
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isSubmitting}
              >
                <option value="adjust_in">Ingreso manual (+)</option>
                <option value="adjust_out">Ajuste negativo (-)</option>
                <option value="loss">Perdida</option>
                <option value="expired">Vencimiento</option>
                <option value="transfer">Transferir a otra sucursal</option>
              </select>
            </div>

            {operation === "transfer" && (
              <div className="space-y-2">
                <Label className="font-bold text-sm">Sucursal destino</Label>
                <select
                  value={toBranchId}
                  onChange={(e) => setToBranchId(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isSubmitting}
                >
                  <option value="">Seleccionar sucursal destino</option>
                  {branches
                    .filter((branch) => branch.id !== item.branchId)
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  Existencia
                </p>
                <p className="text-xl font-black">
                  {item.stock} {item.unit || "uds"}
                </p>
              </div>
              <div className="h-8 w-px bg-muted-foreground/20" />
              <div className="text-right space-y-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  Proyectado
                </p>
                <p
                  className={`text-xl font-black ${
                    outgoing ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {currentTotal} {item.unit || "uds"}
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount" className="font-bold text-sm">
                Cantidad
              </Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  className="text-2xl font-black h-14 pl-12 focus-visible:ring-primary/20"
                  disabled={isSubmitting}
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  {outgoing ? (
                    <Minus className="h-6 w-6 text-red-500" />
                  ) : (
                    <Plus className="h-6 w-6 text-green-500" />
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason" className="font-bold text-sm">
                Motivo (opcional)
              </Label>
              <Input
                id="reason"
                placeholder="Ej: conteo fisico, mercaderia danada, traslado"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="font-bold"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className={`font-bold px-8 ${
                outgoing ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Registrando..." : "Confirmar Movimiento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryModule() {
  const {
    products: inventory,
    isLoading,
    registerStockMovement,
    mutateProducts,
  } = useProducts();
  const { branches, branchId } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const { toast } = useToast();
  const { data: categoriesData } = useSWR<Category[]>("/categories", swrFetcher);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    (categoriesData ?? []).forEach((category) => {
      if (category?.id) map.set(category.id, category.name);
    });
    return map;
  }, [categoriesData]);

  const getProductCategoryValue = (item: Product) => {
    if (item.categoryId) return item.categoryId;
    return getLooseCategoryValue((item as Product & { category?: unknown }).category);
  };

  const getProductCategoryLabel = (item: Product) => {
    if (item.categoryId) {
      return categoryNameById.get(item.categoryId) ?? item.categoryId;
    }
    return getLooseCategoryLabel((item as Product & { category?: unknown }).category);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const filteredInventory = inventory
    .filter((item: Product) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" ||
        getProductCategoryValue(item) === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a: Product, b: Product) => {
      const factor = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * factor;
      if (sortKey === "category") {
        return (
          getProductCategoryLabel(a).localeCompare(getProductCategoryLabel(b)) *
          factor
        );
      }
      if (sortKey === "stock") return ((a.stock || 0) - (b.stock || 0)) * factor;
      return ((a.price || 0) - (b.price || 0)) * factor;
    });

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    inventory.forEach((item: Product) => {
      const value = getProductCategoryValue(item);
      const label = getProductCategoryLabel(item);
      if (!map.has(value)) map.set(value, label);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [inventory, categoriesData]);

  const lowStockItems = inventory.filter(
    (item: Product) => item.stock <= (item.minStock || 0)
  );

  const totalValue = inventory.reduce(
    (sum: number, item: Product) => sum + item.stock * item.price,
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

    const handleMovementSubmit = async (input: {
      type: MovementType;
      quantity: number;
      direction?: "in" | "out";
      reason?: string;
      toBranchId?: string;
    }) => {
      try {
        await registerStockMovement({
          productId: item.id,
          branchId: item.branchId ?? branchId ?? undefined,
          quantity: input.quantity,
          type: input.type,
          unitCost: Number(item.costPrice ?? 0),
          direction: input.direction,
          reason: input.reason,
          toBranchId: input.toBranchId,
        });
        await mutateProducts();

        toast({
          title: "Movimiento registrado",
          description: `Se registro ${input.type} para ${item.name} (${input.quantity} ${item.unit || "unidades"}).`,
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "No se pudo registrar el movimiento",
          description: error?.message ?? "Intenta nuevamente.",
        });
        throw error;
      }
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
                <div
                  className={`p-2.5 rounded-xl ${
                    status === "low" ? "bg-red-500/10" : "bg-primary/10"
                  }`}
                >
                  <Package
                    className={`h-6 w-6 ${
                      status === "low" ? "text-red-500" : "text-primary"
                    }`}
                  />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight truncate group-hover:text-primary transition-colors">
                    {item.name}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-black tracking-widest mt-1 ${getCategoryColor(
                      getProductCategoryLabel(item)
                    )}`}
                  >
                    {getProductCategoryLabel(item)}
                  </Badge>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div
                  className={`text-3xl font-black leading-none ${getStockColor(
                    status
                  )}`}
                >
                  {item.stock}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mt-1">
                  {item.unit || "unidades"} disponibles
                </div>
              </div>
            </div>

            <div className="space-y-1.5 mt-4">
              <Progress
                value={progressValue}
                className={`h-2 ${
                  status === "low" ? "bg-red-100" : "bg-secondary"
                }`}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                <span className={status === "low" ? "text-red-500" : ""}>
                  Mín: {item.minStock || 0}
                </span>
                <span>Capacidad: {item.maxStock || 100}</span>
              </div>
            </div>
          </div>

          {/* Pricing & Valorization */}
          <div className="hidden lg:flex flex-col items-end justify-center px-8 border-l border-dashed min-w-[180px]">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Valorización
              </span>
              <span className="text-xl font-black text-primary">
                ${(item.stock * item.price).toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium italic mt-0.5">
                (Calc. a ${item.price}/u)
              </span>
            </div>
          </div>

          {/* New Control Flow */}
          <div className="flex items-center gap-3 w-full md:w-auto md:pl-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0">
            <AdjustStockDialog
              item={item}
              branches={branches}
              onSubmitMovement={handleMovementSubmit}
            />
          </div>
        </div>
      </Card>
    );
  }

  function SortButton({
    label,
    sortKey: key,
  }: {
    label: string;
    sortKey: SortKey;
  }) {
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
          sortOrder === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3" />
          ) : (
            <ArrowDown className="ml-1 h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
        )}
      </Button>
    );
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
          <p className="text-xs text-muted-foreground">
            Sucursal activa:{" "}
            <span className="font-semibold text-foreground">
              {branches.find((branch) => branch.id === branchId)?.name ?? "Sin sucursal"}
            </span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-b-4 border-b-blue-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Productos
                </p>
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
                <p className="text-sm font-medium text-muted-foreground">
                  Stock Bajo
                </p>
                <p className="text-3xl font-bold mt-1 text-red-500">
                  {lowStockItems.length}
                </p>
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
                <p className="text-sm font-medium text-muted-foreground">
                  Valor Total
                </p>
                <p className="text-3xl font-bold mt-1">
                  ${totalValue.toLocaleString()}
                </p>
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
                <p className="text-sm font-medium text-muted-foreground">
                  Categorías
                </p>
                <p className="text-3xl font-bold mt-1">{categories.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-red-500 p-2 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="text-red-900 font-bold">Resumen de Reposición</h4>
            <p className="text-red-700 text-sm">
              Hay {lowStockItems.length} productos con stock crítico. Se
              recomienda revisar:
              <span className="font-bold ml-1">
                {lowStockItems
                  .slice(0, 3)
                  .map((item: Product) => item.name)
                  .join(", ")}
                {lowStockItems.length > 3
                  ? ` y ${lowStockItems.length - 3} más...`
                  : ""}
              </span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 text-red-700 hover:bg-red-100 font-bold"
            onClick={() => setSelectedCategory("all")}
          >
            Ver Todo
          </Button>
        </div>
      )}

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
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>

            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-sm text-muted-foreground font-medium mr-2">
                Ordenar por:
              </span>
              <SortButton label="Nombre" sortKey="name" />
              <SortButton label="Stock" sortKey="stock" />
              <SortButton label="Categoría" sortKey="category" />
              <SortButton label="Precio" sortKey="price" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="w-full p-4">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full space-y-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                    <Skeleton className="h-10 w-28 shrink-0" />
                  </div>
                </Card>
              ))
            ) : filteredInventory.length > 0 ? (
              filteredInventory.map((item: Product) => (
                <InventoryItemCard key={item.id} item={item} />
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No se encontraron productos con los filtros aplicados
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
