"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Search,
  Package,
  TrendingUp,
  TrendingDown,
  History,
  AlertTriangle,
  Tag,
  ChevronLeft,
  ChevronRight,
  Box,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import type { ProductListItem, MovementType } from "@/lib/api-types";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number) {
  return Number(n ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function fmtQty(n: number, unit?: string | null) {
  const qty = Number(n ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 3 });
  return unit ? `${qty} ${unit}` : qty;
}

function marginPct(cost: number, sell: number): number | null {
  if (!cost || cost <= 0) return null;
  return ((sell - cost) / cost) * 100;
}

const UNIT_LABELS: Record<string, string> = {
  unit: "uds",
  gram: "g",
  kg: "kg",
  ml: "ml",
  liter: "L",
};

type MovTypeFilter = MovementType | "ALL";

const MOV_LABELS: Record<MovTypeFilter, string> = {
  ALL: "Todos",
  PURCHASE: "Compra",
  SALE: "Venta",
  TRANSFER_IN: "Entrada transfer.",
  TRANSFER_OUT: "Salida transfer.",
  ADJUSTMENT: "Ajuste",
  RETURN: "Devolución",
  LOSS: "Pérdida",
  EXPIRED: "Vencimiento",
};

const MOV_SIGN: Record<MovementType, 1 | -1> = {
  PURCHASE: 1,
  SALE: -1,
  TRANSFER_IN: 1,
  TRANSFER_OUT: -1,
  ADJUSTMENT: 1,
  RETURN: 1,
  LOSS: -1,
  EXPIRED: -1,
};

const MOV_COLOR: Record<MovementType, string> = {
  PURCHASE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  SALE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  TRANSFER_IN: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  TRANSFER_OUT:
    "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  ADJUSTMENT:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  RETURN:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  LOSS: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  EXPIRED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function thisMonthRange() {
  const today = new Date();
  return {
    from: toDateStr(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toDateStr(today),
  };
}

const PRODUCT_PAGE_SIZE = 30;
const MOV_PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// ProductInspector
// ---------------------------------------------------------------------------

export function ProductInspector() {
  const { branchId } = useUser();

  // Product list
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [productPage, setProductPage] = useState(1);
  const [selected, setSelected] = useState<ProductListItem | null>(null);

  // Movement filters — default: current month
  const defaultRange = thisMonthRange();
  const [movType, setMovType] = useState<MovTypeFilter>("ALL");
  const [movFrom, setMovFrom] = useState(defaultRange.from);
  const [movTo, setMovTo] = useState(defaultRange.to);
  const [movPage, setMovPage] = useState(1);

  // ── Product list ──────────────────────────────────────────────────────────
  const { data: productsData, isLoading: productsLoading } = useSWR(
    branchId
      ? ["pi-products", branchId, debouncedSearch, productPage]
      : null,
    () =>
      backendApi.products.list({
        search: debouncedSearch || undefined,
        page: productPage,
        limit: PRODUCT_PAGE_SIZE,
      }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  // ── Stock for selected product ────────────────────────────────────────────
  const { data: stockData, isLoading: stockLoading } = useSWR(
    branchId && selected
      ? ["pi-stock", branchId, selected.id]
      : null,
    () => backendApi.stocks.getByBranchAndProduct(branchId!, selected!.id),
    { revalidateOnFocus: false }
  );

  // ── Movement history ──────────────────────────────────────────────────────
  const { data: movData, isLoading: movLoading } = useSWR(
    branchId && selected
      ? ["pi-movements", branchId, selected.id, movType, movFrom, movTo, movPage]
      : null,
    () =>
      backendApi.stockMovements.list({
        productId: selected!.id,
        type: movType === "ALL" ? undefined : movType,
        from: movFrom || undefined,
        to: movTo || undefined,
        page: movPage,
        limit: MOV_PAGE_SIZE,
      }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  // ── Derived values ────────────────────────────────────────────────────────
  const products: ProductListItem[] =
    (productsData as any)?.items ?? [];
  const productTotal: number =
    (productsData as any)?.meta?.total ?? products.length;
  const productTotalPages = Math.max(
    1,
    Math.ceil(productTotal / PRODUCT_PAGE_SIZE)
  );

  const movements: any[] = (movData as any)?.data ?? movData ?? [];
  const movTotal: number = (movData as any)?.total ?? movements.length;
  const movTotalPages = Math.max(1, Math.ceil(movTotal / MOV_PAGE_SIZE));

  const unit = selected
    ? (UNIT_LABELS[selected.measurementType] ?? "uds")
    : "uds";

  const retMargin = selected
    ? marginPct(
        Number(selected.costPrice),
        Number(selected.retailPrice)
      )
    : null;

  const whlMargin = selected
    ? marginPct(
        Number(selected.costPrice),
        Number(selected.wholesalePrice)
      )
    : null;

  const sameRetailWholesale =
    selected &&
    Number(selected.retailPrice) === Number(selected.wholesalePrice);

  function selectProduct(p: ProductListItem) {
    setSelected(p);
    setMovPage(1);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4" style={{ minHeight: 620 }}>
      {/* ── Left: product list ── */}
      <div className="w-72 shrink-0 flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setProductPage(1);
              setSelected(null);
            }}
            className="pl-9 h-9"
          />
        </div>

        <div
          className="border rounded-md divide-y bg-background overflow-y-auto"
          style={{ maxHeight: 540 }}
        >
          {productsLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}

          {!productsLoading && products.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Sin resultados
            </div>
          )}

          {products?.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProduct(p)}
              className={`w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors ${
                selected?.id === p.id
                  ? "bg-primary/10 border-l-2 border-primary"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate leading-tight">
                  {p.name}
                </span>
                {selected?.id === p.id && (
                  <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">
                  {p.sku}
                </span>
                {p.stock != null && (
                  <span
                    className={`text-xs font-medium ${
                      Number(p.stock) <= 0
                        ? "text-red-500"
                        : "text-emerald-600"
                    }`}
                  >
                    {fmtQty(
                      Number(p.stock),
                      UNIT_LABELS[p.measurementType]
                    )}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {productTotalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={productPage <= 1}
              onClick={() => setProductPage((n) => n - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {productPage} / {productTotalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={productPage >= productTotalPages}
              onClick={() => setProductPage((n) => n + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Right: product detail ── */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <Package className="h-12 w-12 mx-auto opacity-20" />
            <p className="text-sm">
              Seleccioná un producto para ver su detalle
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-4 min-w-0">
          {/* Product header */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold leading-tight">
                      {selected.name}
                    </h2>
                    {!selected.isActive && (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                    {selected.priceReviewPending && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Revisar precio
                      </Badge>
                    )}
                    {selected.costReviewPending && (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Revisar costo
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                      {selected.sku}
                    </span>
                    {selected.barcode && (
                      <span>EAN: {selected.barcode}</span>
                    )}
                    {selected.brand && <span>{selected.brand}</span>}
                    {selected.categoryName && (
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3 shrink-0" />
                        {selected.categoryName}
                      </span>
                    )}
                    {selected.measurementType !== "unit" && (
                      <span className="capitalize">
                        {UNIT_LABELS[selected.measurementType] ?? selected.measurementType}
                      </span>
                    )}
                    {selected.stockBaseProductId && (
                      <Badge variant="outline" className="text-xs">
                        Stock compartido
                      </Badge>
                    )}
                  </div>

                  {selected.description && (
                    <p className="text-sm text-muted-foreground mt-1.5">
                      {selected.description}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Stock actual */}
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                  <Box className="h-3.5 w-3.5" />
                  Stock actual
                </p>
                {stockLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : stockData ? (
                  <>
                    <p
                      className={`text-2xl font-bold ${
                        Number(stockData.quantity) <= 0
                          ? "text-red-500"
                          : ""
                      }`}
                    >
                      {fmtQty(Number(stockData.quantity), unit)}
                    </p>
                    {Number(stockData.averageCost) > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Prom. {fmt(Number(stockData.averageCost))}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </CardContent>
            </Card>

            {/* Costo */}
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground mb-1.5">Costo</p>
                <p className="text-2xl font-bold">
                  {fmt(Number(selected.costPrice))}
                </p>
                {stockData &&
                  Number(stockData.averageCost) > 0 &&
                  Math.abs(
                    Number(stockData.averageCost) -
                      Number(selected.costPrice)
                  ) > 1 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Prom. {fmt(Number(stockData.averageCost))}
                    </p>
                  )}
              </CardContent>
            </Card>

            {/* Precio min. */}
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground mb-1.5">
                  Precio min.
                </p>
                <p className="text-2xl font-bold">
                  {fmt(Number(selected.retailPrice))}
                </p>
                {retMargin !== null && (
                  <MarginLine pct={retMargin} threshold={[30, 15]} />
                )}
              </CardContent>
            </Card>

            {/* Precio may. */}
            {!sameRetailWholesale && (
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Precio may.
                  </p>
                  <p className="text-2xl font-bold">
                    {fmt(Number(selected.wholesalePrice))}
                  </p>
                  {whlMargin !== null && (
                    <MarginLine pct={whlMargin} threshold={[20, 10]} />
                  )}
                </CardContent>
              </Card>
            )}

            {sameRetailWholesale && (
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Margen
                  </p>
                  {retMargin !== null && (
                    <p
                      className={`text-2xl font-bold ${
                        retMargin >= 30
                          ? "text-emerald-600"
                          : retMargin >= 15
                          ? "text-amber-500"
                          : "text-red-500"
                      }`}
                    >
                      {retMargin.toFixed(1)}%
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {retMargin !== null
                      ? fmt(Number(selected.retailPrice) - Number(selected.costPrice)) + " / u"
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Movement history */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Historial de movimientos
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={movType}
                    onValueChange={(v) => {
                      setMovType(v as MovTypeFilter);
                      setMovPage(1);
                    }}
                  >
                    <SelectTrigger className="w-44 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MOV_LABELS) as MovTypeFilter[]).map(
                        (t) => (
                          <SelectItem key={t} value={t}>
                            {MOV_LABELS[t]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={movFrom}
                    max={movTo || undefined}
                    onChange={(e) => {
                      setMovFrom(e.target.value);
                      setMovPage(1);
                    }}
                    className="w-36 h-8 text-sm"
                  />
                  <span className="text-muted-foreground text-xs">—</span>
                  <Input
                    type="date"
                    value={movTo}
                    min={movFrom || undefined}
                    onChange={(e) => {
                      setMovTo(e.target.value);
                      setMovPage(1);
                    }}
                    className="w-36 h-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {movLoading && (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}

              {!movLoading && movements.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Sin movimientos en el período seleccionado
                </div>
              )}

              {movements.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                          Fecha
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                          Tipo
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                          Cantidad
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">
                          Costo unit.
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                          Razón
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m: any) => {
                        const sign =
                          MOV_SIGN[m.type as MovementType] ?? 1;
                        const qty = Number(m.quantity);
                        return (
                          <tr
                            key={m.id}
                            className="border-b hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                              {m.createdAt
                                ? new Date(
                                    m.createdAt
                                  ).toLocaleString("es-AR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${
                                  MOV_COLOR[m.type as MovementType] ?? ""
                                }`}
                              >
                                {MOV_LABELS[
                                  m.type as MovementType
                                ] ?? m.type}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-medium tabular-nums ${
                                sign > 0
                                  ? "text-emerald-600"
                                  : "text-red-500"
                              }`}
                            >
                              {sign > 0 ? "+" : "-"}
                              {fmtQty(qty, unit)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                              {m.unitCost
                                ? fmt(Number(m.unitCost))
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-48 truncate">
                              {m.reason ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {movTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    {movTotal} movimiento{movTotal !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={movPage <= 1}
                      onClick={() => setMovPage((n) => n - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-1">
                      {movPage} / {movTotalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={movPage >= movTotalPages}
                      onClick={() => setMovPage((n) => n + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MarginLine helper
// ---------------------------------------------------------------------------

function MarginLine({
  pct,
  threshold,
}: {
  pct: number;
  threshold: [number, number];
}) {
  const [good, mid] = threshold;
  const color =
    pct >= good
      ? "text-emerald-600"
      : pct >= mid
      ? "text-amber-500"
      : "text-red-500";
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <p className={`text-xs mt-0.5 font-medium flex items-center gap-0.5 ${color}`}>
      <Icon className="h-3 w-3" />
      {pct.toFixed(1)}% margen
    </p>
  );
}
