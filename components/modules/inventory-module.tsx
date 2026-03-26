"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Link2,
  Info,
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
import { useProductActions } from "@/components/providers/product-provider";
import useSWR from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";
import type {
  MovementType,
  StockDetail,
  StockListItem,
  StockSharedProduct,
} from "@/lib/api-types";
import { resolveProductImageUrl } from "@/lib/media-utils";
import { backendApi } from "@/lib/backend-api";
import { InventoryLotsSection } from "@/components/modules/inventory-lots-section";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type SortKey = "name" | "stock" | "category" | "price";
type SortOrder = "asc" | "desc";
const LOW_STOCK_THRESHOLD = 5;

function normalizeBranchContextId(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;
  return trimmed;
}

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

type LowStockRow = StockListItem & {
  name?: string;
  product?: Partial<Product> & { id?: string; name?: string };
};

type InventoryRow = StockListItem & {
  name?: string | null;
  product?: Partial<Product> & { id?: string; name?: string };
};

function getLooseCategoryLabel(category: unknown): string {
  if (typeof category === "string" && category.trim()) return category.trim();
  if (category && typeof category === "object") {
    const value = category as { name?: unknown };
    if (typeof value.name === "string" && value.name.trim()) return value.name;
  }
  return "Sin categoria";
}

function toDisplayMeasurementUnit(value: unknown) {
  if (value === "kg") return "kg";
  if (value === "gram") return "gr";
  if (value === "ml") return "ml";
  if (value === "liter") return "lt";
  return "unidades";
}

function resolveInventoryRowName(item: InventoryRow) {
  const directName = String(item.name ?? "").trim();
  if (directName) return directName;
  const nestedName = String(item.product?.name ?? "").trim();
  if (nestedName) return nestedName;
  return item.productId;
}

function resolveInventoryRowPrices(item: InventoryRow) {
  const product = item.product ?? {};
  const costPrice = Number((product as any).costPrice ?? 0);
  const wholesalePrice = Number((product as any).wholesalePrice ?? Number.NaN);
  const retailPrice = Number((product as any).retailPrice ?? Number.NaN);
  const wholesale =
    Number.isFinite(wholesalePrice) && wholesalePrice > 0
      ? wholesalePrice
      : Number.isFinite(retailPrice) && retailPrice > 0
      ? retailPrice
      : Number.isFinite(costPrice)
      ? costPrice
      : 0;

  return {
    costPrice: Number.isFinite(costPrice) ? costPrice : 0,
    wholesaleUnitPrice: wholesale,
  };
}

function resolveInventoryRowCategoryId(item: InventoryRow) {
  const categoryId = String((item.product as any)?.categoryId ?? "").trim();
  return categoryId || null;
}

function resolveInventoryRowImage(item: InventoryRow) {
  return resolveProductImageUrl(
    (item.product ?? (item as unknown as Product)) as Product
  );
}

function resolveLinkedProducts(item: InventoryRow): StockSharedProduct[] {
  const linked = item.sharedStock?.linkedProducts;
  return Array.isArray(linked) ? linked : [];
}

function AdjustStockDialog({
  item,
  branches,
  onSubmitMovement,
}: {
  item: {
    id: string;
    name: string;
    stock: number;
    unit: string;
    branchId?: string | null;
  };
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

  const outgoing =
    operation === "adjust_out" ||
    operation === "loss" ||
    operation === "expired" ||
    operation === "transfer";
  const currentTotal = outgoing
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
                outgoing
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
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

function SortButton({
  label,
  sortKey,
  activeSortKey,
  sortOrder,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortOrder: SortOrder;
  onSort: (key: SortKey) => void;
}) {
  const isActive = activeSortKey === sortKey;

  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      className="h-8 text-xs font-medium"
      onClick={() => onSort(sortKey)}
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

function StockDetailDialog({
  branchId,
  productId,
  productName,
  open,
  onOpenChange,
}: {
  branchId: string | null;
  productId: string | null;
  productName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, error } = useSWR<StockDetail>(
    open && branchId && productId
      ? ["stock-detail", branchId, productId]
      : null,
    () =>
      backendApi.stocks.getByBranchAndProduct(
        branchId as string,
        productId as string
      ),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );

  const baseUnit = String(data?.stockBaseUnit ?? "unidad");
  const linkedProducts = Array.isArray(data?.sharedStock?.linkedProducts)
    ? data?.sharedStock?.linkedProducts ?? []
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Detalle de stock</DialogTitle>
          <DialogDescription>
            {productName || productId || "Producto"} - referencia real de stock.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Cargando detalle...</p>
        )}

        {!isLoading && error && (
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "No se pudo cargar el detalle del stock."}
          </p>
        )}

        {!isLoading && !error && data && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  Producto consultado
                </p>
                <p className="font-semibold">{data.productId || "-"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Stock base real</p>
                <p className="font-semibold">{data.stockProductId || "-"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  Cantidad comercial
                </p>
                <p className="font-semibold">
                  {Number(data.quantity ?? 0).toLocaleString("es-AR")}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Stock real base</p>
                <p className="font-semibold">
                  {Number(data.baseQuantity ?? 0).toLocaleString("es-AR")}{" "}
                  {baseUnit}
                </p>
              </div>
            </div>

            {data.sharedStock?.isShared && (
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Productos vinculados:{" "}
                  {Number(data.sharedStock.linkedProductsCount ?? 0)}
                </p>
                <div className="space-y-2">
                  {linkedProducts.map((linked) => (
                    <div
                      key={linked.id}
                      className="flex items-center justify-between rounded-md border p-2 text-xs"
                    >
                      <div>
                        <p className="font-medium">{linked.name}</p>
                        <p className="text-muted-foreground">
                          {linked.sku ? `SKU ${linked.sku}` : linked.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {linked.isBase && (
                          <Badge variant="outline" className="text-[10px]">
                            Base
                          </Badge>
                        )}
                        <div className="text-right text-muted-foreground">
                          <span>
                            {Number(
                              linked.stockConsumptionQuantity ?? 0
                            ).toLocaleString("es-AR")}{" "}
                            {linked.stockBaseUnit ?? "-"}
                          </span>
                          {Number(data.baseQuantity ?? Number.NaN) > 0 &&
                            Number(
                              linked.stockConsumptionQuantity ?? Number.NaN
                            ) > 0 && (
                              <p className="text-[10px]">
                                ~{" "}
                                {(
                                  Number(data.baseQuantity ?? 0) /
                                  Number(linked.stockConsumptionQuantity ?? 1)
                                ).toLocaleString("es-AR", {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 4,
                                })}
                              </p>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InventoryModule() {
  const { branches, branchId } = useUser();
  const { registerStockMovement } = useProductActions();
  const effectiveBranchId = normalizeBranchContextId(branchId);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [stockDetailTarget, setStockDetailTarget] = useState<{
    productId: string;
    productName: string;
  } | null>(null);
  const pageSize = 20;
  const { toast } = useToast();
  const stocksAbortControllerRef = useRef<AbortController | null>(null);
  const stockSummaryFilters = useMemo(
    () => ({
      branchId: effectiveBranchId,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    }),
    [effectiveBranchId]
  );
  const { data: categoriesData } = useSWR<Category[]>(
    "/categories",
    swrFetcher
  );

  const stockListFilters = useMemo(
    () => ({
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch.trim() || undefined,
      categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
      stockStatus: "all",
    }),
    [currentPage, pageSize, debouncedSearch, selectedCategory]
  );

  const {
    data: stocksPage,
    mutate: mutateStocksList,
    isLoading: isLoadingStocks,
    error: stocksError,
  } = useSWR(
    effectiveBranchId ? ["stocks", effectiveBranchId, stockListFilters] : null,
    async () => {
      stocksAbortControllerRef.current?.abort();
      const controller = new AbortController();
      stocksAbortControllerRef.current = controller;

      try {
        return await backendApi.stocks.list(
          stockListFilters,
          effectiveBranchId,
          {
            signal: controller.signal,
          }
        );
      } finally {
        if (stocksAbortControllerRef.current === controller) {
          stocksAbortControllerRef.current = null;
        }
      }
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );

  const inventory = useMemo(() => {
    const source = (stocksPage?.items ?? []) as InventoryRow[];
    if (source.length === 0) return [];

    const byProductId = new Map<string, InventoryRow>();
    const expandedRows: InventoryRow[] = [];

    const addRow = (row: InventoryRow) => {
      const productId = String(row.productId ?? "").trim();
      if (!productId || byProductId.has(productId)) return;
      byProductId.set(productId, row);
      expandedRows.push(row);
    };

    source.forEach((row) => addRow(row));

    source.forEach((row) => {
      const linkedProducts = resolveLinkedProducts(row).filter(
        (linked) => !linked.isBase
      );
      if (linkedProducts.length === 0) return;

      const baseQuantity = Number(
        row.baseQuantity ?? row.quantity ?? Number.NaN
      );
      const hasBaseQuantity = Number.isFinite(baseQuantity);

      linkedProducts.forEach((linked) => {
        const linkedId = String(linked.id ?? "").trim();
        if (!linkedId || byProductId.has(linkedId)) return;

        const consumption = Number(
          linked.stockConsumptionQuantity ?? Number.NaN
        );
        const hasConsumption = Number.isFinite(consumption) && consumption > 0;
        const derivedQuantity =
          hasBaseQuantity && hasConsumption
            ? Math.max(0, baseQuantity / consumption)
            : Number(row.quantity ?? 0);
        const baseMeasurement = linked.stockBaseUnit ?? row.stockBaseUnit;
        const productSnapshot = {
          ...(row.product ?? {}),
          id: linkedId,
          name: linked.name,
          sku: linked.sku ?? undefined,
          barcode: linked.barcode ?? undefined,
          pluCode: linked.pluCode ?? undefined,
        };

        addRow({
          ...row,
          id: `${row.id}:linked:${linkedId}`,
          productId: linkedId,
          name: linked.name,
          quantity: derivedQuantity,
          baseQuantity: hasBaseQuantity
            ? baseQuantity
            : row.baseQuantity ?? null,
          stockConsumptionQuantity: hasConsumption
            ? consumption
            : row.stockConsumptionQuantity ?? null,
          stockBaseUnit: baseMeasurement ?? row.stockBaseUnit,
          product: productSnapshot,
        });
      });
    });

    return expandedRows;
  }, [stocksPage?.items]);
  const inventoryTotal = Math.max(
    Number(stocksPage?.meta?.total ?? 0),
    inventory.length
  );
  const hasMore = Boolean(stocksPage?.meta?.hasMore);
  const skip = Number(
    stocksPage?.meta?.offset ?? Math.max(0, (currentPage - 1) * pageSize)
  );
  const take = Number(stocksPage?.meta?.limit ?? pageSize);
  const isLoading = isLoadingStocks;
  const isError =
    stocksError instanceof DOMException && stocksError.name === "AbortError"
      ? null
      : stocksError;

  const { data: inventorySummary, mutate: mutateInventorySummary } = useSWR(
    effectiveBranchId ? ["/stocks/summary", stockSummaryFilters] : null,
    () =>
      backendApi.stocks.summary(
        { lowStockThreshold: LOW_STOCK_THRESHOLD },
        effectiveBranchId
      )
  );
  const {
    data: inventorySummaryCategories,
    mutate: mutateInventorySummaryCategories,
  } = useSWR(
    effectiveBranchId
      ? ["/stocks/summary/categories", stockSummaryFilters]
      : null,
    () =>
      backendApi.stocks.summaryCategories(
        { lowStockThreshold: LOW_STOCK_THRESHOLD },
        effectiveBranchId
      )
  );
  const { data: lowStockRows, mutate: mutateLowStockRows } = useSWR<
    LowStockRow[]
  >(
    effectiveBranchId
      ? ["stocks-low-list", effectiveBranchId, LOW_STOCK_THRESHOLD]
      : null,
    async () => {
      const payload = await backendApi.stocks.list(
        {
          stockStatus: "low_stock",
          lowStockThreshold: LOW_STOCK_THRESHOLD,
        },
        effectiveBranchId
      );
      return payload.items as LowStockRow[];
    }
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    (categoriesData ?? []).forEach((category) => {
      if (category?.id) map.set(category.id, category.name);
    });
    return map;
  }, [categoriesData]);

  const getProductCategoryLabel = (item: InventoryRow) => {
    const categoryId = resolveInventoryRowCategoryId(item);
    if (categoryId) {
      const mapped = categoryNameById.get(categoryId);
      if (mapped) return mapped;

      const loose = getLooseCategoryLabel(
        (item.product as Product & { category?: unknown })?.category
      );
      if (loose && loose !== categoryId) return loose;

      return "Sin categoria";
    }
    return getLooseCategoryLabel(
      (item.product as Product & { category?: unknown })?.category
    );
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  useEffect(() => {
    return () => {
      stocksAbortControllerRef.current?.abort();
    };
  }, []);

  const filteredInventory = inventory
    .slice()
    .sort((a: InventoryRow, b: InventoryRow) => {
      const factor = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "name") {
        return (
          resolveInventoryRowName(a).localeCompare(resolveInventoryRowName(b)) *
          factor
        );
      }
      if (sortKey === "category") {
        return (
          getProductCategoryLabel(a).localeCompare(getProductCategoryLabel(b)) *
          factor
        );
      }
      if (sortKey === "stock") {
        return (Number(a.quantity ?? 0) - Number(b.quantity ?? 0)) * factor;
      }
      return (
        (resolveInventoryRowPrices(a).wholesaleUnitPrice -
          resolveInventoryRowPrices(b).wholesaleUnitPrice) *
        factor
      );
    });

  const categories = useMemo(() => {
    return (categoriesData ?? [])
      .filter((category) => Boolean(category?.id) && Boolean(category?.name))
      .map((category) => ({
        value: category.id,
        label: category.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoriesData]);

  const totalValueFallback = inventory.reduce(
    (sum: number, item: InventoryRow) =>
      sum +
      Number(item.quantity ?? 0) *
        resolveInventoryRowPrices(item).wholesaleUnitPrice,
    0
  );
  const inventoryNameById = useMemo(
    () =>
      new Map(
        inventory.map((item) => [item.productId, resolveInventoryRowName(item)])
      ),
    [inventory]
  );
  const lowStockNamesPreview = useMemo(() => {
    if (!Array.isArray(lowStockRows)) return [];

    const names = lowStockRows
      .map((row) => {
        const directName = typeof row.name === "string" ? row.name.trim() : "";
        if (directName) return directName;

        const nestedName =
          typeof row.product?.name === "string" ? row.product.name.trim() : "";
        if (nestedName) return nestedName;

        const productId =
          typeof row.productId === "string"
            ? row.productId
            : typeof row.product?.id === "string"
            ? row.product.id
            : null;
        if (!productId) return "";
        return inventoryNameById.get(productId) ?? "";
      })
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set(names)).slice(0, 3);
  }, [lowStockRows, inventoryNameById]);
  const totalProductsKpi = inventorySummary?.products.total ?? inventoryTotal;
  const lowStockCountKpi =
    inventorySummary?.products.lowStock ?? lowStockRows?.length ?? 0;
  const inventoryValueKpi =
    inventorySummary?.inventoryValue.wholesale ?? totalValueFallback;
  const categoriesTotalKpi =
    inventorySummaryCategories?.total ?? categories.length;
  const lowStockHiddenCount = Math.max(
    lowStockCountKpi - lowStockNamesPreview.length,
    0
  );
  const totalPages = Math.max(
    1,
    Math.ceil((inventoryTotal || 0) / Math.max(take, 1))
  );
  const showingFrom = inventoryTotal === 0 ? 0 : skip + 1;
  const showingTo = inventoryTotal === 0 ? 0 : skip + filteredInventory.length;

  const getStockStatus = (
    stock: number,
    minStock: number,
    maxStock: number
  ) => {
    if (stock <= minStock) return "low";
    if (stock >= maxStock * 0.8) return "high";
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

  const getProgressValue = (stock: number, maxStock: number) => {
    const max = maxStock || 100;
    return (stock / max) * 100;
  };

  function InventoryItemCard({ item }: { item: InventoryRow }) {
    const itemName = resolveInventoryRowName(item);
    const categoryLabel = getProductCategoryLabel(item);
    const stockQuantity = Number(item.quantity ?? 0);
    const minStock = Number((item.product as any)?.minStock ?? 0);
    const maxStock = Number((item.product as any)?.maxStock ?? 100);
    const measurementType = (item.product as any)?.measurementType;
    const unitLabel = toDisplayMeasurementUnit(measurementType);
    const status = getStockStatus(stockQuantity, minStock, maxStock);
    const progressValue = getProgressValue(stockQuantity, maxStock);
    const { costPrice, wholesaleUnitPrice } = resolveInventoryRowPrices(item);
    const inventoryValue = stockQuantity * wholesaleUnitPrice;
    const linkedProducts = resolveLinkedProducts(item);
    const linkedProductsCount = Number(
      item.sharedStock?.linkedProductsCount ?? linkedProducts.length
    );
    const isSharedStock = Boolean(item.sharedStock?.isShared);
    const consumptionQuantity = Number(item.stockConsumptionQuantity ?? 1);
    const consumptionLabel = item.stockBaseUnit ?? "unidad";
    const baseQuantity = Number(item.baseQuantity ?? Number.NaN);
    const hasLinkedBase =
      Boolean(item.stockProductId) &&
      Boolean(item.productId) &&
      item.stockProductId !== item.productId;
    const relativeStockFromBase =
      hasLinkedBase &&
      Number.isFinite(baseQuantity) &&
      Number.isFinite(consumptionQuantity) &&
      consumptionQuantity > 0
        ? Math.max(0, baseQuantity / consumptionQuantity)
        : null;
    const adjustDialogItem = {
      id: item.productId,
      name: itemName,
      stock: stockQuantity,
      unit: unitLabel,
      branchId: item.branchId ?? effectiveBranchId ?? null,
    };

    const handleMovementSubmit = async (input: {
      type: MovementType;
      quantity: number;
      direction?: "in" | "out";
      reason?: string;
      toBranchId?: string;
    }) => {
      try {
        await registerStockMovement({
          productId: item.productId,
          branchId: item.branchId ?? effectiveBranchId ?? undefined,
          quantity: input.quantity,
          type: input.type,
          unitCost: costPrice,
          direction: input.direction,
          reason: input.reason,
          toBranchId: input.toBranchId,
        });
        await Promise.all([
          mutateStocksList(),
          mutateInventorySummary(),
          mutateInventorySummaryCategories(),
          mutateLowStockRows(),
        ]);

        toast({
          title: "Movimiento registrado",
          description: `Se registro ${input.type} para ${itemName} (${input.quantity} ${unitLabel}).`,
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
            Reposicion Urgente
          </div>
        )}
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    status === "low" ? "bg-red-500/10" : "bg-primary/10"
                  }`}
                >
                  <img
                    src={resolveInventoryRowImage(item)}
                    alt={itemName}
                    className="h-10 w-10 rounded-md object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight truncate group-hover:text-primary transition-colors">
                    {itemName}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-black tracking-widest ${getCategoryColor(
                        categoryLabel
                      )}`}
                    >
                      {categoryLabel}
                    </Badge>
                    {isSharedStock && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-black uppercase tracking-widest"
                      >
                        Stock compartido
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div
                  className={`text-3xl font-black leading-none ${getStockColor(
                    status
                  )}`}
                >
                  {stockQuantity.toLocaleString("es-AR", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mt-1">
                  {unitLabel} disponibles
                </div>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              {isSharedStock ? (
                <div className="inline-flex items-center gap-1 text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>{linkedProductsCount} productos vinculados</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  <span>Stock propio</span>
                </div>
              )}
              {isSharedStock && linkedProductsCount > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-[11px]"
                    >
                      <Info className="h-3 w-3" />
                      Ver vinculados
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="start">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      Productos vinculados al mismo stock base
                    </p>
                    <div className="space-y-2">
                      {linkedProducts.map((linked) => (
                        <div
                          key={linked.id}
                          className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {linked.name}
                            </p>
                            <p className="truncate text-muted-foreground">
                              {linked.sku ? `SKU ${linked.sku}` : linked.id}
                            </p>
                          </div>
                          <div className="ml-3 flex items-center gap-1">
                            {linked.isBase && (
                              <Badge variant="outline" className="text-[10px]">
                                Base
                              </Badge>
                            )}
                            <span className="text-muted-foreground">
                              {Number(
                                linked.stockConsumptionQuantity ?? 0
                              ).toLocaleString("es-AR", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 4,
                              })}{" "}
                              {linked.stockBaseUnit ?? "-"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
              Consume{" "}
              <span className="font-semibold text-foreground">
                {consumptionQuantity.toLocaleString("es-AR", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}{" "}
                {consumptionLabel}
              </span>{" "}
              por unidad vendida
            </p>
            {relativeStockFromBase !== null && (
              <p className="mb-3 text-xs text-muted-foreground">
                Stock relativo estimado:{" "}
                <span className="font-semibold text-foreground">
                  {Number(relativeStockFromBase).toLocaleString("es-AR", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {unitLabel}
                </span>{" "}
                (base real:{" "}
                {baseQuantity.toLocaleString("es-AR", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 4,
                })}{" "}
                {consumptionLabel})
              </p>
            )}

            <div className="space-y-1.5 mt-4">
              <Progress
                value={progressValue}
                className={`h-2 ${
                  status === "low" ? "bg-red-100" : "bg-secondary"
                }`}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                <span className={status === "low" ? "text-red-500" : ""}>
                  Min: {minStock}
                </span>
                <span>Capacidad: {maxStock}</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex flex-col items-end justify-center px-8 border-l border-dashed min-w-[180px]">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Valorizacion
              </span>
              <span className="text-xl font-black text-primary">
                ${inventoryValue.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium italic mt-0.5">
                (Calc. a ${wholesaleUnitPrice.toLocaleString()}/u mayorista)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto md:pl-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0">
            <AdjustStockDialog
              item={adjustDialogItem}
              branches={branches}
              onSubmitMovement={handleMovementSubmit}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 px-4 font-bold gap-2"
              onClick={() =>
                setStockDetailTarget({
                  productId: item.productId,
                  productName: itemName,
                })
              }
            >
              <Info className="h-4 w-4" />
              Detalle
            </Button>
          </div>
        </div>
      </Card>
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
              {branches.find((branch) => branch.id === effectiveBranchId)
                ?.name ?? "Sin sucursal"}
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
                <p className="text-3xl font-bold mt-1">
                  {totalProductsKpi.toLocaleString()}
                </p>
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
                  {lowStockCountKpi.toLocaleString()}
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
                  ${inventoryValueKpi.toLocaleString()}
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
                <p className="text-3xl font-bold mt-1">
                  {categoriesTotalKpi.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStockCountKpi > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-red-500 p-2 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="text-red-900 font-bold">Resumen de Reposición</h4>
            <p className="text-red-700 text-sm">
              Hay {lowStockCountKpi} productos con stock crítico. Se recomienda
              revisar:
              <span className="font-bold ml-1">
                {lowStockNamesPreview.length > 0
                  ? lowStockNamesPreview.join(", ")
                  : "productos con stock bajo"}
                {lowStockNamesPreview.length > 0 && lowStockHiddenCount > 0
                  ? ` y ${lowStockHiddenCount} más...`
                  : ""}
              </span>
            </p>
          </div>
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
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-[240px] px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
              <SortButton
                label="Nombre"
                sortKey="name"
                activeSortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortButton
                label="Stock"
                sortKey="stock"
                activeSortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortButton
                label="Categoría"
                sortKey="category"
                activeSortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortButton
                label="Precio"
                sortKey="price"
                activeSortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isError && !isLoading && (
            <p className="mb-4 text-sm text-destructive">
              {isError instanceof Error
                ? isError.message
                : "No se pudo cargar el inventario."}
            </p>
          )}
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
              filteredInventory.map((item: InventoryRow) => (
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
          {!isLoading && inventoryTotal > 0 && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {showingFrom}-{showingTo} de {inventoryTotal}{" "}
                productos. Pagina {currentPage} de {totalPages}.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage <= 1}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={!hasMore}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <InventoryLotsSection
        branchId={effectiveBranchId}
        categories={categories}
      />
      <StockDetailDialog
        branchId={effectiveBranchId}
        productId={stockDetailTarget?.productId ?? null}
        productName={stockDetailTarget?.productName ?? null}
        open={Boolean(stockDetailTarget)}
        onOpenChange={(open) => {
          if (!open) setStockDetailTarget(null);
        }}
      />
    </div>
  );
}
