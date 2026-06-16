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
  AlertCircle,
  Tag,
  ChevronLeft,
  ChevronRight,
  Box,
  ShoppingCart,
  BarChart2,
  Truck,
  Info,
  Minus,
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
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import type {
  ProductListItem,
  MovementType,
  ProductInsightsResponse,
  ProductInsightsSalesPeriod,
} from "@/lib/api-types";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function fmtCompact(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return fmt(v);
}

function fmtQty(n: number | null | undefined, unit?: string | null) {
  const qty = Number(n ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 3 });
  return unit ? `${qty} ${unit}` : qty;
}

function marginPct(cost: number, sell: number): number | null {
  if (!cost || cost <= 0) return null;
  return ((sell - cost) / cost) * 100;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
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
  PURCHASE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  SALE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  TRANSFER_IN: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  TRANSFER_OUT: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  ADJUSTMENT: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  RETURN: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  LOSS: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  EXPIRED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const CLASS_LABELS: Record<string, { label: string; color: string }> = {
  A: { label: "A – Alta rotación", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  B: { label: "B – Buena rotación", color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  C: { label: "C – Baja rotación", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  DEAD: { label: "Muerto (+90d)", color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  NEVER_SOLD: { label: "Sin ventas", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  NEW: { label: "Nuevo", color: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" },
};

function thisMonthRange() {
  const today = new Date();
  return {
    from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

type Tab = "analysis" | "prices" | "stock" | "purchases" | "movements";

const TABS: { id: Tab; label: string; icon: typeof BarChart2 }[] = [
  { id: "analysis", label: "Análisis", icon: BarChart2 },
  { id: "prices", label: "Precios", icon: Tag },
  { id: "stock", label: "Stock", icon: Box },
  { id: "purchases", label: "Compras", icon: Truck },
  { id: "movements", label: "Movimientos", icon: History },
];

const PRODUCT_PAGE_SIZE = 30;
const MOV_PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// ProductInspector
// ---------------------------------------------------------------------------

export function ProductInspector() {
  const { branchId } = useUser();

  // Product list state
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [productPage, setProductPage] = useState(1);
  const [selected, setSelected] = useState<ProductListItem | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("analysis");

  // Movement filters
  const defaultRange = thisMonthRange();
  const [movType, setMovType] = useState<MovTypeFilter>("ALL");
  const [movFrom, setMovFrom] = useState(defaultRange.from);
  const [movTo, setMovTo] = useState(defaultRange.to);
  const [movPage, setMovPage] = useState(1);

  // ── Product list ──────────────────────────────────────────────────────────
  const { data: productsData, isLoading: productsLoading } = useSWR(
    branchId ? ["pi-products", branchId, debouncedSearch, productPage] : null,
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
    branchId && selected ? ["pi-stock", branchId, selected.id] : null,
    () => backendApi.stocks.getByBranchAndProduct(branchId!, selected!.id),
    { revalidateOnFocus: false }
  );

  // ── Insights (new endpoint) ───────────────────────────────────────────────
  const { data: insights, isLoading: insightsLoading } = useSWR(
    branchId && selected ? ["pi-insights", branchId, selected.id] : null,
    () => backendApi.products.getInsights(selected!.id),
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
  const products: ProductListItem[] = (productsData as any)?.items ?? [];
  const productTotal: number = (productsData as any)?.meta?.total ?? products.length;
  const productTotalPages = Math.max(1, Math.ceil(productTotal / PRODUCT_PAGE_SIZE));

  const movements: any[] = (movData as any)?.data ?? movData ?? [];
  const movTotal: number = (movData as any)?.total ?? movements.length;
  const movTotalPages = Math.max(1, Math.ceil(movTotal / MOV_PAGE_SIZE));

  const unit = selected ? (UNIT_LABELS[selected.measurementType] ?? "uds") : "uds";

  const retMargin = selected
    ? marginPct(Number(selected.costPrice), Number(selected.retailPrice))
    : null;
  const whlMargin = selected
    ? marginPct(Number(selected.costPrice), Number(selected.wholesalePrice))
    : null;
  const sameRetailWholesale =
    selected && Number(selected.retailPrice) === Number(selected.wholesalePrice);

  function selectProduct(p: ProductListItem) {
    setSelected(p);
    setMovPage(1);
    setActiveTab("analysis");
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
          style={{ maxHeight: 580 }}
        >
          {productsLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}

          {!productsLoading && products.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">Sin resultados</div>
          )}

          {products?.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProduct(p)}
              className={`w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors ${
                selected?.id === p.id ? "bg-primary/10 border-l-2 border-primary" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate leading-tight">{p.name}</span>
                {selected?.id === p.id && (
                  <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">{p.sku}</span>
                {p.stock != null && (
                  <span
                    className={`text-xs font-medium ${
                      Number(p.stock) <= 0 ? "text-red-500" : "text-emerald-600"
                    }`}
                  >
                    {fmtQty(Number(p.stock), UNIT_LABELS[p.measurementType])}
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
            <p className="text-sm">Seleccioná un producto para ver su detalle</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 space-y-3">
          {/* ── Product header ── */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold leading-tight">{selected.name}</h2>
                    {!selected.isActive && <Badge variant="secondary">Inactivo</Badge>}
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
                    {insights && !insightsLoading && (
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          CLASS_LABELS[insights.classification]?.color ?? ""
                        }`}
                      >
                        {CLASS_LABELS[insights.classification]?.label ?? insights.classification}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                      {selected.sku}
                    </span>
                    {selected.barcode && <span>EAN: {selected.barcode}</span>}
                    {selected.brand && <span>{selected.brand}</span>}
                    {selected.categoryName && (
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3 shrink-0" />
                        {selected.categoryName}
                      </span>
                    )}
                    {selected.stockBaseProductId && (
                      <Badge variant="outline" className="text-xs">Stock compartido</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Alert bar ── */}
          {!insightsLoading && insights && insights.alerts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {insights.alerts.map((alert, i) => (
                <AlertChip key={i} severity={alert.severity} message={alert.message} />
              ))}
            </div>
          )}

          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <KpiCard
              label="Stock actual"
              loading={stockLoading}
              value={fmtQty(Number(stockData?.quantity ?? 0), unit)}
              sub={
                stockData && Number(stockData.averageCost) > 0
                  ? `Prom. ${fmt(Number(stockData.averageCost))}`
                  : undefined
              }
              valueColor={
                Number(stockData?.quantity ?? 0) <= 0 ? "text-red-500" : undefined
              }
              icon={Box}
            />
            <KpiCard
              label="Cobertura estim."
              loading={insightsLoading}
              value={
                insights?.stockCoverageDays != null
                  ? `${insights.stockCoverageDays} días`
                  : "—"
              }
              valueColor={
                insights?.isCriticalStock
                  ? "text-red-500"
                  : insights?.stockCoverageDays != null && insights.stockCoverageDays <= 15
                  ? "text-amber-500"
                  : undefined
              }
              icon={Package}
            />
            <KpiCard
              label="Unid. vendidas 30d"
              loading={insightsLoading}
              value={fmtQty(insights?.sales30d?.units ?? 0, unit)}
              sub={`${insights?.sales30d?.transactions ?? 0} tickets`}
              icon={ShoppingCart}
            />
            <KpiCard
              label="Facturación 30d"
              loading={insightsLoading}
              value={fmtCompact(insights?.sales30d?.revenue ?? 0)}
              sub={
                insights?.sales30d?.profit != null
                  ? `Ganancia ${fmtCompact(insights.sales30d.profit)}`
                  : undefined
              }
              icon={TrendingUp}
            />
            <KpiCard
              label="Margen (precio min.)"
              loading={false}
              value={retMargin != null ? `${retMargin.toFixed(1)}%` : "—"}
              valueColor={
                retMargin == null
                  ? undefined
                  : retMargin >= 30
                  ? "text-emerald-600"
                  : retMargin >= 15
                  ? "text-amber-500"
                  : "text-red-500"
              }
              sub={
                retMargin != null
                  ? `${fmt(Number(selected.retailPrice) - Number(selected.costPrice))} / u`
                  : undefined
              }
              icon={BarChart2}
            />
          </div>

          {/* ── Tabs ── */}
          <div>
            {/* Tab bar */}
            <div className="flex border-b gap-0 mb-3">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── Tab: Análisis ── */}
            {activeTab === "analysis" && (
              <div className="space-y-4">
                {/* Period comparison table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Comparativo de períodos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {insightsLoading ? (
                      <div className="p-4 space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : (
                      <PeriodTable insights={insights} unit={unit} />
                    )}
                  </CardContent>
                </Card>

                {/* Monthly trend chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                      <span>Tendencia mensual (12 meses)</span>
                      {insights?.velocity && (
                        <VelocityTrend trend={insights.velocity.trend} pct={insights.velocity.growthPct} />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {insightsLoading ? (
                      <Skeleton className="h-48 w-full" />
                    ) : !insights?.monthlyTrend?.length ? (
                      <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                        Sin datos de ventas en los últimos 12 meses
                      </div>
                    ) : (
                      <TrendChart data={insights.monthlyTrend} />
                    )}
                  </CardContent>
                </Card>

                {/* Velocity + Ranking */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Velocity */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Velocidad de venta
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {insightsLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-6 w-full" />
                          ))}
                        </div>
                      ) : insights?.velocity ? (
                        <div className="space-y-2 text-sm">
                          <DataRow
                            label="Promedio diario (30d)"
                            value={`${fmtQty(insights.velocity.dailyAvg30d, unit)} / día`}
                          />
                          <DataRow
                            label="Promedio semanal (30d)"
                            value={`${fmtQty(insights.velocity.weeklyAvg30d, unit)} / sem`}
                          />
                          <DataRow
                            label="Promedio mensual (30d)"
                            value={`${fmtQty(insights.velocity.monthlyAvg30d, unit)} / mes`}
                          />
                          {insights.lastSaleAt && (
                            <DataRow
                              label="Última venta"
                              value={
                                <>
                                  {fmtDateShort(insights.lastSaleAt)}
                                  {insights.daysSinceLastSale != null && (
                                    <span className="text-muted-foreground ml-1">
                                      (hace {insights.daysSinceLastSale}d)
                                    </span>
                                  )}
                                </>
                              }
                            />
                          )}
                          {!insights.lastSaleAt && (
                            <DataRow label="Última venta" value="Sin ventas registradas" />
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin datos</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Ranking */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Posicionamiento (últimos 30d)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {insightsLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-6 w-full" />
                          ))}
                        </div>
                      ) : insights ? (
                        <div className="space-y-2 text-sm">
                          {insights.paretoRank != null ? (
                            <>
                              <DataRow
                                label="Ranking global"
                                value={`#${insights.paretoRank} de ${insights.paretoTotal}`}
                              />
                              {insights.categoryRank != null && (
                                <DataRow
                                  label="Ranking en categoría"
                                  value={`#${insights.categoryRank} de ${insights.categoryTotal}`}
                                />
                              )}
                              {insights.revenueSharePct != null && (
                                <DataRow
                                  label="Participación en ventas"
                                  value={`${insights.revenueSharePct.toFixed(2)}%`}
                                />
                              )}
                            </>
                          ) : (
                            <p className="text-muted-foreground text-sm">
                              Sin ventas en los últimos 30 días para calcular ranking
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin datos</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ── Tab: Precios ── */}
            {activeTab === "prices" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <PriceCard
                    label="Costo"
                    value={fmt(Number(selected.costPrice))}
                    sub={
                      stockData && Number(stockData.averageCost) > 0 &&
                      Math.abs(Number(stockData.averageCost) - Number(selected.costPrice)) > 1
                        ? `Prom. stock: ${fmt(Number(stockData.averageCost))}`
                        : undefined
                    }
                  />
                  <PriceCard
                    label="Precio min."
                    value={fmt(Number(selected.retailPrice))}
                    margin={retMargin}
                    threshold={[30, 15]}
                    profit={Number(selected.retailPrice) - Number(selected.costPrice)}
                  />
                  {!sameRetailWholesale && (
                    <PriceCard
                      label="Precio may."
                      value={fmt(Number(selected.wholesalePrice))}
                      margin={whlMargin}
                      threshold={[20, 10]}
                      profit={Number(selected.wholesalePrice) - Number(selected.costPrice)}
                    />
                  )}
                </div>

                {/* Margin guide */}
                <Card>
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wide">
                      Estructura de precio (minorista)
                    </p>
                    <div className="space-y-2 text-sm">
                      <DataRow label="Costo" value={fmt(Number(selected.costPrice))} />
                      <DataRow label="Precio de venta" value={fmt(Number(selected.retailPrice))} />
                      <DataRow
                        label="Ganancia unitaria"
                        value={
                          <span
                            className={
                              Number(selected.retailPrice) > Number(selected.costPrice)
                                ? "text-emerald-600 font-medium"
                                : "text-red-500 font-medium"
                            }
                          >
                            {fmt(Number(selected.retailPrice) - Number(selected.costPrice))}
                          </span>
                        }
                      />
                      <DataRow
                        label="Margen sobre costo"
                        value={
                          retMargin != null ? (
                            <span
                              className={
                                retMargin >= 30
                                  ? "text-emerald-600 font-medium"
                                  : retMargin >= 15
                                  ? "text-amber-500 font-medium"
                                  : "text-red-500 font-medium"
                              }
                            >
                              {retMargin.toFixed(1)}%
                            </span>
                          ) : (
                            "—"
                          )
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Tab: Stock ── */}
            {activeTab === "stock" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Estado del stock
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {stockLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-6 w-full" />
                          ))}
                        </div>
                      ) : stockData ? (
                        <div className="space-y-2 text-sm">
                          <DataRow
                            label="Cantidad en stock"
                            value={
                              <span
                                className={
                                  Number(stockData.quantity) <= 0
                                    ? "text-red-500 font-bold text-base"
                                    : "font-bold text-base"
                                }
                              >
                                {fmtQty(Number(stockData.quantity), unit)}
                              </span>
                            }
                          />
                          {Number(stockData.averageCost) > 0 && (
                            <DataRow
                              label="Costo promedio"
                              value={fmt(Number(stockData.averageCost))}
                            />
                          )}
                          {Number(stockData.quantity) > 0 &&
                            Number(stockData.averageCost) > 0 && (
                              <DataRow
                                label="Valor del inventario"
                                value={fmt(
                                  Number(stockData.quantity) * Number(stockData.averageCost)
                                )}
                              />
                            )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin datos de stock</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Cobertura estimada
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {insightsLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-6 w-full" />
                          ))}
                        </div>
                      ) : insights ? (
                        <div className="space-y-2 text-sm">
                          <DataRow
                            label="Promedio ventas diarias (30d)"
                            value={`${fmtQty(insights.velocity.dailyAvg30d, unit)} / día`}
                          />
                          <DataRow
                            label="Stock actual"
                            value={fmtQty(insights.currentStock, unit)}
                          />
                          <DataRow
                            label="Cobertura estimada"
                            value={
                              insights.stockCoverageDays != null ? (
                                <span
                                  className={
                                    insights.isCriticalStock
                                      ? "text-red-500 font-bold"
                                      : insights.stockCoverageDays <= 15
                                      ? "text-amber-500 font-medium"
                                      : "text-emerald-600 font-medium"
                                  }
                                >
                                  {insights.stockCoverageDays} días
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Sin ventas recientes para estimar
                                </span>
                              )
                            }
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin datos</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ── Tab: Compras ── */}
            {activeTab === "purchases" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Últimas ingresos por compra
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {insightsLoading ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                      ))}
                    </div>
                  ) : !insights?.purchaseHistory?.length ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Sin registros de compras para este producto
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                              Fecha
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                              Cantidad
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">
                              Costo unit.
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {insights.purchaseHistory.map((p, i) => (
                            <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                                {fmtDate(p.date)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-medium tabular-nums text-emerald-600">
                                +{fmtQty(p.quantity, unit)}
                              </td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                                {p.unitCost > 0 ? fmt(p.unitCost) : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                                {p.totalCost > 0 ? fmt(p.totalCost) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Tab: Movimientos ── */}
            {activeTab === "movements" && (
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
                          {(Object.keys(MOV_LABELS) as MovTypeFilter[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {MOV_LABELS[t]}
                            </SelectItem>
                          ))}
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
                            const sign = MOV_SIGN[m.type as MovementType] ?? 1;
                            const qty = Number(m.quantity);
                            return (
                              <tr
                                key={m.id}
                                className="border-b hover:bg-muted/30 transition-colors"
                              >
                                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                                  {fmtDate(m.createdAt)}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${
                                      MOV_COLOR[m.type as MovementType] ?? ""
                                    }`}
                                  >
                                    {MOV_LABELS[m.type as MovementType] ?? m.type}
                                  </span>
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right font-medium tabular-nums ${
                                    sign > 0 ? "text-emerald-600" : "text-red-500"
                                  }`}
                                >
                                  {sign > 0 ? "+" : "-"}
                                  {fmtQty(qty, unit)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                                  {m.unitCost ? fmt(Number(m.unitCost)) : "—"}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AlertChip
// ---------------------------------------------------------------------------

function AlertChip({
  severity,
  message,
}: {
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
}) {
  const styles = {
    CRITICAL: {
      cls: "bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-300",
      icon: AlertCircle,
    },
    WARNING: {
      cls: "bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300",
      icon: AlertTriangle,
    },
    INFO: {
      cls: "bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300",
      icon: Info,
    },
  };
  const { cls, icon: Icon } = styles[severity];
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  loading,
  valueColor,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  loading: boolean;
  valueColor?: string;
  icon: typeof Box;
}) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <>
            <p className={`text-xl font-bold leading-tight ${valueColor ?? ""}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PriceCard
// ---------------------------------------------------------------------------

function PriceCard({
  label,
  value,
  sub,
  margin,
  threshold,
  profit,
}: {
  label: string;
  value: string;
  sub?: string;
  margin?: number | null;
  threshold?: [number, number];
  profit?: number;
}) {
  const [good, mid] = threshold ?? [30, 15];
  const color =
    margin == null
      ? ""
      : margin < 0
      ? "text-red-500"
      : margin >= good
      ? "text-emerald-600"
      : margin >= mid
      ? "text-amber-500"
      : "text-red-500";
  const Icon = margin != null && margin >= 0 ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {margin != null && (
          <p className={`text-xs mt-1 font-medium flex items-center gap-0.5 ${color}`}>
            <Icon className="h-3 w-3" />
            {margin.toFixed(1)}% margen
          </p>
        )}
        {profit != null && margin != null && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {profit > 0 ? "+" : ""}
            {profit.toLocaleString("es-AR", {
              style: "currency",
              currency: "ARS",
              maximumFractionDigits: 0,
            })}{" "}
            / u
          </p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DataRow
// ---------------------------------------------------------------------------

function DataRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 border-b last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PeriodTable
// ---------------------------------------------------------------------------

function PeriodTable({
  insights,
  unit,
}: {
  insights: ProductInsightsResponse | undefined;
  unit: string;
}) {
  if (!insights) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">Sin datos</div>
    );
  }

  const rows: { label: string; data: ProductInsightsSalesPeriod }[] = [
    { label: "7 días", data: insights.sales7d },
    { label: "30 días", data: insights.sales30d },
    { label: "90 días", data: insights.sales90d },
    { label: "12 meses", data: insights.sales365d },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Período</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Unidades</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Tickets</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Facturación</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Ganancia</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Margen%</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">
              Prom. diario
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const margin =
              row.data.revenue > 0
                ? (row.data.profit / row.data.revenue) * 100
                : null;
            const marginColor =
              margin == null
                ? ""
                : margin >= 30
                ? "text-emerald-600"
                : margin >= 15
                ? "text-amber-500"
                : "text-red-500";

            return (
              <tr key={row.label} className="border-b hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-medium">{row.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.data.units > 0 ? fmtQty(row.data.units, unit) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {row.data.transactions > 0 ? row.data.transactions : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                  {row.data.revenue > 0 ? fmt(row.data.revenue) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.data.profit > 0 ? (
                    <span className="text-emerald-600">{fmt(row.data.profit)}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${marginColor}`}>
                  {margin != null ? `${margin.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {row.data.avgDailyUnits > 0
                    ? fmtQty(row.data.avgDailyUnits, unit)
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrendChart
// ---------------------------------------------------------------------------

function TrendChart({
  data,
}: {
  data: { month: string; units: number; revenue: number; profit: number }[];
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.month.slice(0, 7).replace("-", "/"),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis
          yAxisId="left"
          tickFormatter={(v) => fmtCompact(v)}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
          width={58}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            fmt(value),
            name === "revenue" ? "Facturación" : "Ganancia",
          ]}
          labelClassName="font-medium"
          contentStyle={{ fontSize: 12 }}
        />
        <Bar yAxisId="left" dataKey="revenue" name="revenue" fill="#3b82f6" radius={[2, 2, 0, 0]} opacity={0.8} />
        <Bar yAxisId="left" dataKey="profit" name="profit" fill="#10b981" radius={[2, 2, 0, 0]} opacity={0.8} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// VelocityTrend
// ---------------------------------------------------------------------------

function VelocityTrend({
  trend,
  pct,
}: {
  trend: "UP" | "DOWN" | "STABLE";
  pct: number | null;
}) {
  if (trend === "UP") {
    return (
      <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
        <TrendingUp className="h-3.5 w-3.5" />
        {pct != null ? `+${pct.toFixed(1)}% vs mes anterior` : "En alza"}
      </span>
    );
  }
  if (trend === "DOWN") {
    return (
      <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
        <TrendingDown className="h-3.5 w-3.5" />
        {pct != null ? `${pct.toFixed(1)}% vs mes anterior` : "En baja"}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium">
      <Minus className="h-3.5 w-3.5" />
      Estable
    </span>
  );
}
