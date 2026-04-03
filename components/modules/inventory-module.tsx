"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  MeasurementType,
  MovementType,
  ReportsInventoryLowStockResponse,
  ReportsInventorySummaryResponse,
  StockDetail,
  StockListItem,
  StockSharedProduct,
} from "@/lib/api-types";
import { resolveProductImageUrl } from "@/lib/media-utils";
import { backendApi } from "@/lib/backend-api";
import { InventoryLotsSection } from "@/components/modules/inventory-lots-section";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import {
  formatWholeAmountInput,
  normalizeWholeAmountInput,
  parseWholeAmount,
} from "@/lib/sales-payments";
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

function normalizeMeasurementType(value: unknown): MeasurementType | null {
  if (
    value === "unit" ||
    value === "gram" ||
    value === "kg" ||
    value === "ml" ||
    value === "liter"
  ) {
    return value;
  }
  return null;
}

function resolveMeasurementTypeFromItem(
  item:
    | InventoryRow
    | StockDetail
    | (Partial<Product> & { product?: Partial<Product> | null })
    | null
    | undefined
) {
  const direct = normalizeMeasurementType(
    (item as { measurementType?: unknown } | null | undefined)?.measurementType
  );
  if (direct) return direct;

  const nested = normalizeMeasurementType(
    (
      item as
        | { product?: { measurementType?: unknown; isWeighable?: unknown } | null }
        | null
        | undefined
    )?.product?.measurementType
  );
  if (nested) return nested;

  const isWeighable =
    Boolean(
      (item as { isWeighable?: unknown } | null | undefined)?.isWeighable
    ) ||
    Boolean(
      (
        item as
          | { product?: { isWeighable?: unknown } | null }
          | null
          | undefined
      )?.product?.isWeighable
    );

  return isWeighable ? "kg" : "unit";
}

function formatInventoryQuantity(
  value: unknown,
  measurementType: unknown,
  options?: { precise?: boolean }
) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";

  const normalizedMeasurementType = normalizeMeasurementType(measurementType);
  const precise = options?.precise ?? false;
  const hasFraction = Math.abs(numericValue - Math.trunc(numericValue)) > 0.000001;

  let maximumFractionDigits = 0;

  if (
    normalizedMeasurementType === "kg" ||
    normalizedMeasurementType === "liter"
  ) {
    maximumFractionDigits = precise ? 4 : 3;
  } else if (
    normalizedMeasurementType === "gram" ||
    normalizedMeasurementType === "ml"
  ) {
    maximumFractionDigits = hasFraction ? (precise ? 3 : 2) : 0;
  } else if (normalizedMeasurementType === "unit") {
    maximumFractionDigits = hasFraction ? (precise ? 3 : 2) : 0;
  } else {
    maximumFractionDigits = hasFraction ? (precise ? 3 : 2) : 0;
  }

  return numericValue.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatInventoryQuantityWithUnit(
  value: unknown,
  measurementType: unknown,
  options?: { precise?: boolean }
) {
  return `${formatInventoryQuantity(value, measurementType, options)} ${toDisplayMeasurementUnit(
    measurementType
  )}`;
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

function toTrimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteQuantity(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function buildInventoryRowFromProduct(
  product: Partial<Product>,
  fallbackBranchId: string | null
): InventoryRow {
  const productId = toTrimmedText(product.id);
  const productName = toTrimmedText(product.name) || productId;
  const branchId =
    normalizeBranchContextId(
      toTrimmedText(product.branchId) || fallbackBranchId || undefined
    ) ?? "";
  const stockQuantity = toFiniteQuantity((product as any).stock, 0);
  const stockConsumptionQuantity = Math.max(
    toFiniteQuantity((product as any).stockConsumptionQuantity, 1),
    1
  );
  const measurementType =
    normalizeMeasurementType((product as any).measurementType) ??
    (Boolean((product as any).isWeighable) ? "kg" : "unit");
  const stockBaseProductId =
    toTrimmedText((product as any).stockBaseProductId) || productId;
  const isSharedStock = Boolean(
    productId && stockBaseProductId && stockBaseProductId !== productId
  );
  const baseQuantity = isSharedStock
    ? stockQuantity * stockConsumptionQuantity
    : stockQuantity;

  return {
    id: [branchId || "branch", productId || "product"].join(":"),
    branchId,
    productId,
    stockProductId: stockBaseProductId || productId,
    quantity: stockQuantity,
    baseQuantity: Number.isFinite(baseQuantity) ? baseQuantity : null,
    stockConsumptionQuantity,
    stockBaseUnit:
      normalizeMeasurementType((product as any).stockBaseUnit) ?? measurementType,
    sharedStock: isSharedStock
      ? {
          stockProductId: stockBaseProductId || productId,
          isShared: true,
          linkedProductsCount: 0,
          linkedProducts: [],
        }
      : null,
    averageCost: toFiniteQuantity((product as any).costPrice, 0),
    createdAt:
      typeof product.createdAt === "string" ? product.createdAt : undefined,
    updatedAt:
      typeof product.updatedAt === "string" ? product.updatedAt : undefined,
    name: productName || productId,
    product: {
      ...product,
      id: productId || undefined,
      name: productName || undefined,
      branchId: branchId || undefined,
      stock: stockQuantity,
      measurementType,
    },
  };
}

function buildStockDetailFromInventoryRow(item: InventoryRow): StockDetail {
  return {
    ...item,
    stockProductId:
      toTrimmedText(item.stockProductId) || toTrimmedText(item.productId) || null,
    baseQuantity: item.baseQuantity ?? toFiniteQuantity(item.quantity, 0),
  };
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
    const quantity = Math.abs(parseWholeAmount(amount));
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
    ? Math.max(0, item.stock - parseWholeAmount(amount))
    : item.stock + parseWholeAmount(amount);

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
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatWholeAmountInput(amount)}
                  onChange={(e) =>
                    setAmount(normalizeWholeAmountInput(e.target.value))
                  }
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
  fallbackItem,
  open,
  onOpenChange,
}: {
  branchId: string | null;
  productId: string | null;
  productName: string | null;
  fallbackItem: InventoryRow | null;
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

  const fallbackDetail = useMemo(
    () => (fallbackItem ? buildStockDetailFromInventoryRow(fallbackItem) : null),
    [fallbackItem]
  );
  const detail = data ?? fallbackDetail;
  const detailMeasurementType = resolveMeasurementTypeFromItem(detail ?? undefined);
  const baseMeasurementType =
    normalizeMeasurementType(detail?.stockBaseUnit) ?? detailMeasurementType;
  const baseUnit = toDisplayMeasurementUnit(baseMeasurementType);
  const linkedProducts = Array.isArray(detail?.sharedStock?.linkedProducts)
    ? detail?.sharedStock?.linkedProducts ?? []
    : [];
  const detailConsumptionQuantity = Number(
    detail?.stockConsumptionQuantity ?? Number.NaN
  );
  const detailBaseQuantity = Number(detail?.baseQuantity ?? Number.NaN);
  const detailRelativeStock =
    Number.isFinite(detailBaseQuantity) &&
    Number.isFinite(detailConsumptionQuantity) &&
    detailConsumptionQuantity > 0
      ? Math.max(0, detailBaseQuantity / detailConsumptionQuantity)
      : null;

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

        {!isLoading && error && !detail && (
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "No se pudo cargar el detalle del stock."}
          </p>
        )}

        {!isLoading && error && detail && (
          <p className="text-xs text-muted-foreground">
            No existe una fila de stock creada para este producto. Se muestra el
            detalle calculado desde el catalogo actual.
          </p>
        )}

        {!isLoading && detail && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  Producto consultado
                </p>
                <p className="font-semibold">{detail.productId || "-"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Stock base real</p>
                <p className="font-semibold">{detail.stockProductId || "-"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  Cantidad comercial
                </p>
                <p className="font-semibold">
                  {formatInventoryQuantityWithUnit(
                    detail.quantity ?? 0,
                    detailMeasurementType,
                    { precise: Boolean(detail.sharedStock?.isShared) }
                  )}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Stock real base</p>
                <p className="font-semibold">
                  {formatInventoryQuantityWithUnit(
                    detail.baseQuantity ?? 0,
                    baseMeasurementType,
                    { precise: true }
                  )}
                </p>
              </div>
            </div>

            {detail.sharedStock?.isShared && detailRelativeStock !== null && (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Calculo compartido:{" "}
                <span className="font-semibold text-foreground">
                  {formatInventoryQuantity(detailBaseQuantity, baseMeasurementType, {
                    precise: true,
                  })}{" "}
                  {baseUnit}
                </span>{" "}
                /{" "}
                <span className="font-semibold text-foreground">
                  {formatInventoryQuantity(detailConsumptionQuantity, baseMeasurementType, {
                    precise: true,
                  })}{" "}
                  {baseUnit}
                </span>{" "}
                por producto ={" "}
                <span className="font-semibold text-foreground">
                  {formatInventoryQuantity(detailRelativeStock, detailMeasurementType, {
                    precise: true,
                  })}{" "}
                  {toDisplayMeasurementUnit(detailMeasurementType)}
                </span>
                .
              </div>
            )}

            {detail.sharedStock?.isShared && (
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Productos vinculados:{" "}
                  {Number(detail.sharedStock.linkedProductsCount ?? 0)}
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
                            {formatInventoryQuantity(
                              linked.stockConsumptionQuantity ?? 0,
                              linked.stockBaseUnit,
                              {
                                precise: true,
                              }
                            )}{" "}
                            {toDisplayMeasurementUnit(linked.stockBaseUnit)}
                          </span>
                          {Number(detail.baseQuantity ?? Number.NaN) > 0 &&
                            Number(
                              linked.stockConsumptionQuantity ?? Number.NaN
                            ) > 0 && (
                              <p className="text-[10px]">
                                ~{" "}
                                {formatInventoryQuantity(
                                  Number(detail.baseQuantity ?? 0) /
                                    Number(linked.stockConsumptionQuantity ?? 1),
                                  detailMeasurementType,
                                  { precise: true }
                                )}
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
  const criticalTableRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [stockDetailTarget, setStockDetailTarget] = useState<{
    productId: string;
    productName: string;
    item: InventoryRow;
  } | null>(null);
  const pageSize = 20;
  const { toast } = useToast();
  const productsAbortControllerRef = useRef<AbortController | null>(null);
  const { data: categoriesData } = useSWR<Category[]>(
    "/categories",
    swrFetcher
  );

  const inventoryQuery = useMemo(
    () => ({
      skip: Math.max(0, (currentPage - 1) * pageSize),
      take: pageSize,
      search: debouncedSearch.trim() || undefined,
      categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
    }),
    [currentPage, pageSize, debouncedSearch, selectedCategory]
  );

  const {
    data: inventoryPage,
    mutate: mutateInventoryPage,
    isLoading: isLoadingInventoryPage,
    error: inventoryPageError,
  } = useSWR(
    effectiveBranchId ? ["inventory-products", effectiveBranchId, inventoryQuery] : null,
    async () => {
      productsAbortControllerRef.current?.abort();
      const controller = new AbortController();
      productsAbortControllerRef.current = controller;

      try {
        return await backendApi.productsWithStock(
          {
            ...inventoryQuery,
            name: inventoryQuery.search,
            q: inventoryQuery.search,
          },
          effectiveBranchId,
          {
            signal: controller.signal,
          }
        );
      } finally {
        if (productsAbortControllerRef.current === controller) {
          productsAbortControllerRef.current = null;
        }
      }
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );
  const { data: stockRows, mutate: mutateStockRows } = useSWR<InventoryRow[]>(
    effectiveBranchId ? ["stocks-branch", effectiveBranchId] : null,
    () =>
      backendApi.stocks
        .listByBranch(effectiveBranchId as string)
        .then((rows) => rows as InventoryRow[]),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );

  const inventory = useMemo(() => {
    const sourceProducts = (inventoryPage?.items ?? []) as Product[];
    if (sourceProducts.length === 0) return [];

    const stockByProductId = new Map<string, InventoryRow>();
    (stockRows ?? []).forEach((row) => {
      const productId = String(row.productId ?? "").trim();
      if (!productId || stockByProductId.has(productId)) return;
      stockByProductId.set(productId, row);
    });

    return sourceProducts.map((product) => {
      const fallbackRow = buildInventoryRowFromProduct(product, effectiveBranchId);
      const stockRow = stockByProductId.get(fallbackRow.productId);
      if (!stockRow) return fallbackRow;

      const resolvedQuantity = toFiniteQuantity(
        (product as any).stock,
        toFiniteQuantity(stockRow.quantity, fallbackRow.quantity)
      );
      const resolvedName =
        toTrimmedText(stockRow.name) ||
        toTrimmedText(fallbackRow.name) ||
        fallbackRow.productId;

      return {
        ...fallbackRow,
        ...stockRow,
        productId: stockRow.productId || fallbackRow.productId,
        stockProductId:
          toTrimmedText(stockRow.stockProductId) || fallbackRow.stockProductId,
        branchId: toTrimmedText(stockRow.branchId) || fallbackRow.branchId,
        quantity: resolvedQuantity,
        baseQuantity: stockRow.baseQuantity ?? fallbackRow.baseQuantity,
        stockConsumptionQuantity:
          stockRow.stockConsumptionQuantity ?? fallbackRow.stockConsumptionQuantity,
        stockBaseUnit: stockRow.stockBaseUnit ?? fallbackRow.stockBaseUnit,
        averageCost: toFiniteQuantity(
          stockRow.averageCost,
          fallbackRow.averageCost
        ),
        name: resolvedName,
        product: {
          ...(fallbackRow.product ?? {}),
          ...(stockRow.product ?? {}),
          id: fallbackRow.productId || undefined,
          name: resolvedName || undefined,
          branchId:
            toTrimmedText(stockRow.branchId) ||
            toTrimmedText((fallbackRow.product as any)?.branchId) ||
            undefined,
          stock: resolvedQuantity,
        },
      };
    });
  }, [inventoryPage?.items, stockRows, effectiveBranchId]);
  const inventoryTotal = Number(inventoryPage?.total ?? inventory.length);
  const hasMore = Boolean(inventoryPage?.hasMore);
  const skip = Number(
    inventoryPage?.skip ?? Math.max(0, (currentPage - 1) * pageSize)
  );
  const take = Number(inventoryPage?.take ?? pageSize);
  const isLoading = isLoadingInventoryPage;
  const isError =
    inventoryPageError instanceof DOMException &&
    inventoryPageError.name === "AbortError"
      ? null
      : inventoryPageError;

  const { data: inventorySummary, mutate: mutateInventorySummary } = useSWR<ReportsInventorySummaryResponse>(
    effectiveBranchId
      ? ["/reporting/inventory/summary", effectiveBranchId, LOW_STOCK_THRESHOLD]
      : null,
    () =>
      backendApi.reporting.inventory.summary(
        { lowStockThreshold: LOW_STOCK_THRESHOLD },
        effectiveBranchId
      )
  );
  const { data: lowStockResponse, mutate: mutateLowStockRows } = useSWR<ReportsInventoryLowStockResponse>(
    effectiveBranchId
      ? ["/reporting/inventory/low-stock", effectiveBranchId, LOW_STOCK_THRESHOLD]
      : null,
    () =>
      backendApi.reporting.inventory.lowStock(
        {
          page: 1,
          limit: 100,
          lowStockThreshold: LOW_STOCK_THRESHOLD,
        },
        effectiveBranchId
      )
  );
  const lowStockRows = useMemo(
    () => lowStockResponse?.items ?? [],
    [lowStockResponse?.items]
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
      productsAbortControllerRef.current?.abort();
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
  const shouldPaginateLocally = filteredInventory.length > take;
  const effectiveInventoryTotal = shouldPaginateLocally
    ? filteredInventory.length
    : inventoryTotal;
  const effectiveSkip = shouldPaginateLocally
    ? Math.max(0, (currentPage - 1) * take)
    : skip;
  const visibleInventory = shouldPaginateLocally
    ? filteredInventory.slice(effectiveSkip, effectiveSkip + take)
    : filteredInventory;

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
  const inventoryByProductId = useMemo(
    () => new Map(inventory.map((item) => [item.productId, item])),
    [inventory]
  );
  const lowStockNamesPreview = useMemo(() => {
    if (!Array.isArray(lowStockRows)) return [];

    const names = lowStockRows
      .map((row) => {
        const directName =
          typeof row.productName === "string" ? row.productName.trim() : "";
        if (directName) return directName;

        const productId =
          typeof row.productId === "string" ? row.productId.trim() : null;
        if (!productId) return "";
        return inventoryNameById.get(productId) ?? "";
      })
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set(names)).slice(0, 3);
  }, [lowStockRows, inventoryNameById]);
  const totalProductsKpi = Number(inventorySummary?.productsTotal ?? inventoryTotal);
  const lowStockCountKpi = Number(
    inventorySummary?.lowStockTotal ?? lowStockRows.length
  );
  const inventoryValueKpi = Number(
    inventorySummary?.inventoryValueWholesale ?? totalValueFallback
  );
  const categoriesTotalKpi = Number(
    inventorySummary?.byCategory?.length ?? categories.length
  );
  const lowStockHiddenCount = Math.max(
    lowStockCountKpi - lowStockNamesPreview.length,
    0
  );
  const outOfStockRows = useMemo(
    () =>
      lowStockRows.filter((row) => Number(row.stock ?? 0) <= Number.EPSILON),
    [lowStockRows]
  );
  const criticalStockRows = useMemo(
    () =>
      lowStockRows.filter((row) => Number(row.stock ?? 0) > Number.EPSILON),
    [lowStockRows]
  );
  const totalPages = Math.max(
    1,
    Math.ceil((effectiveInventoryTotal || 0) / Math.max(take, 1))
  );
  const effectiveHasMore = shouldPaginateLocally
    ? effectiveSkip + take < effectiveInventoryTotal
    : hasMore;
  const showingFrom = effectiveInventoryTotal === 0 ? 0 : effectiveSkip + 1;
  const showingTo =
    effectiveInventoryTotal === 0 ? 0 : effectiveSkip + visibleInventory.length;

  useEffect(() => {
    if (currentPage <= totalPages) return;
    setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
    const measurementType = resolveMeasurementTypeFromItem(item);
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
    const baseMeasurementType =
      normalizeMeasurementType(item.stockBaseUnit) ?? measurementType;
    const consumptionLabel = toDisplayMeasurementUnit(baseMeasurementType);
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
    const formattedStockQuantity = formatInventoryQuantity(
      stockQuantity,
      measurementType,
      { precise: isSharedStock }
    );
    const formattedConsumptionQuantity = formatInventoryQuantity(
      consumptionQuantity,
      baseMeasurementType,
      { precise: true }
    );
    const formattedBaseQuantity = Number.isFinite(baseQuantity)
      ? formatInventoryQuantity(baseQuantity, baseMeasurementType, {
          precise: true,
        })
      : null;
    const formattedRelativeStock =
      relativeStockFromBase !== null
        ? formatInventoryQuantity(relativeStockFromBase, measurementType, {
            precise: true,
          })
        : null;
    const formattedMinStock = formatInventoryQuantity(minStock, measurementType);
    const formattedMaxStock = formatInventoryQuantity(maxStock, measurementType);
    const adjustDialogItem = {
      id: item.productId,
      name: itemName,
      stock: stockQuantity,
      unit: unitLabel,
      measurementType,
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
          mutateInventoryPage(),
          mutateStockRows(),
          mutateInventorySummary(),
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
          description: getUserFacingErrorMessage(
            error,
            "Revisa los datos del movimiento e intenta nuevamente."
          ),
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
                  {formattedStockQuantity}
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
                              {formatInventoryQuantity(
                                linked.stockConsumptionQuantity ?? 0,
                                linked.stockBaseUnit,
                                {
                                  precise: true,
                                }
                              )}{" "}
                              {toDisplayMeasurementUnit(linked.stockBaseUnit)}
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
                {formattedConsumptionQuantity}{" "}
                {consumptionLabel}
              </span>{" "}
              por unidad vendida
            </p>
            {isSharedStock && !hasLinkedBase && formattedBaseQuantity && (
              <p className="mb-3 text-xs text-muted-foreground">
                Stock base compartido real:{" "}
                <span className="font-semibold text-foreground">
                  {formattedBaseQuantity} {consumptionLabel}
                </span>
                . Los productos vinculados descuentan de este mismo saldo.
              </p>
            )}
            {relativeStockFromBase !== null && (
              <p className="mb-3 text-xs text-muted-foreground">
                Stock relativo estimado:{" "}
                <span className="font-semibold text-foreground">
                  {formattedRelativeStock}{" "}
                  {unitLabel}
                </span>{" "}
                (base real:{" "}
                {formattedBaseQuantity} {consumptionLabel})
              </p>
            )}
            {isSharedStock &&
              relativeStockFromBase !== null &&
              formattedBaseQuantity && (
                <p className="mb-3 text-xs text-muted-foreground">
                  Calculo compartido:{" "}
                  <span className="font-semibold text-foreground">
                    {formattedBaseQuantity} {consumptionLabel}
                  </span>{" "}
                  /{" "}
                  <span className="font-semibold text-foreground">
                    {formattedConsumptionQuantity} {consumptionLabel}
                  </span>{" "}
                  por producto ={" "}
                  <span className="font-semibold text-foreground">
                    {formattedRelativeStock} {unitLabel}
                  </span>
                  .
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
                  Min: {formattedMinStock} {unitLabel}
                </span>
                <span>Capacidad: {formattedMaxStock} {unitLabel}</span>
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
                (Calc. a ${wholesaleUnitPrice.toLocaleString()}/{unitLabel} mayorista)
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
                  item,
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

      {lowStockRows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="border-red-200 shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Alertas de stock</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Prioriza primero los articulos agotados.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    criticalTableRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                >
                  Ver tabla critica
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-red-200 bg-red-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  Sin stock
                </p>
                <p className="mt-1 text-3xl font-black text-red-600">
                  {outOfStockRows.length.toLocaleString()}
                </p>
                <p className="text-xs text-red-700">
                  Productos sin unidades disponibles para vender.
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Stock critico
                </p>
                <p className="mt-1 text-3xl font-black text-amber-600">
                  {criticalStockRows.length.toLocaleString()}
                </p>
                <p className="text-xs text-amber-700">
                  Productos con stock bajo, pero todavia disponibles.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card ref={criticalTableRef} className="border-red-200 shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">
                    Tabla de stock critico
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Lista directa para reponer articulos con faltante.
                  </p>
                </div>
                <Badge className="w-fit bg-red-100 text-red-800 hover:bg-red-100">
                  {lowStockRows.length} articulos en alerta
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">
                          Producto
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Stock
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Minimo
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Faltante
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lowStockRows.map((row) => {
                        const linkedInventoryItem =
                          inventoryByProductId.get(row.productId) ?? null;
                        const isOutOfStock =
                          Number(row.stock ?? 0) <= Number.EPSILON;

                        return (
                          <tr
                            key={row.productId}
                            className="transition-colors hover:bg-muted/25"
                          >
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium">{row.productName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {row.category?.name ?? "Sin categoria"}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {Number(row.stock ?? 0).toLocaleString("es-AR")}
                            </td>
                            <td className="px-4 py-3">
                              {Number(row.minStock ?? 0).toLocaleString("es-AR")}
                            </td>
                            <td className="px-4 py-3 font-bold text-red-600">
                              {Number(row.shortageQty ?? 0).toLocaleString("es-AR")}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                className={
                                  isOutOfStock
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                                }
                              >
                                {isOutOfStock ? "Sin stock" : "Critico"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSearchQuery(row.productName);
                                    setCurrentPage(1);
                                  }}
                                >
                                  Filtrar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    if (!linkedInventoryItem) return;
                                    setStockDetailTarget({
                                      productId: row.productId,
                                      productName: row.productName,
                                      item: linkedInventoryItem,
                                    });
                                  }}
                                  disabled={!linkedInventoryItem}
                                >
                                  Detalle
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
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
            ) : visibleInventory.length > 0 ? (
              visibleInventory.map((item: InventoryRow) => (
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
          {!isLoading && effectiveInventoryTotal > 0 && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {showingFrom}-{showingTo} de {effectiveInventoryTotal}{" "}
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
                  disabled={!effectiveHasMore}
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
        fallbackItem={stockDetailTarget?.item ?? null}
        open={Boolean(stockDetailTarget)}
        onOpenChange={(open) => {
          if (!open) setStockDetailTarget(null);
        }}
      />
    </div>
  );
}
