"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download } from "lucide-react";
import useSWR from "swr";

import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";
import { useUser } from "@/components/providers/user-provider";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";
import { backendApi } from "@/lib/backend-api";
import type {
  MeasurementType,
  ReportsSalesPricingSourcesSummaryItem,
  ReportsSalesPriceTypesSummaryItem,
  ReportsTopProductItem,
} from "@/lib/api-types";

const PIE_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#14b8a6",
];
const DETAIL_PAGE_SIZE = 10;
const METRICS_PAGE_SIZE = 300;
const PRODUCT_LOOKUP_BATCH_SIZE = 30;
const MAX_METRICS_PAGES = 100;

type DateRange = {
  from?: Date;
  to?: Date;
};

function toYmd(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

function shortLabel(label: string, max = 20) {
  if (!label) return "Sin nombre";
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}...`;
}

function getPricingSourceLabel(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "AUTO") return "Automatico";
  if (normalized === "MANUAL") return "Manual";
  return value;
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

function getTopProductMeasurementType(
  item: ReportsTopProductItem
): MeasurementType | null {
  const measurementType = normalizeMeasurementType(item.measurementType);
  if (measurementType) return measurementType;
  if (typeof item.isWeighable === "boolean") {
    return item.isWeighable ? "kg" : "unit";
  }
  return null;
}

function formatQuantity(value: number, maximumFractionDigits = 3) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export function SalesReport({ dateRange }: { dateRange: DateRange }) {
  const { branchId } = useUser();
  const [detailSearchInput, setDetailSearchInput] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const debouncedDetailSearch = useDebouncedValue(detailSearchInput, 350);

  const range = useMemo(() => {
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 30);

    const from = dateRange?.from ?? defaultFrom;
    const to = dateRange?.to ?? today;

    return {
      from,
      to,
      fromYmd: toYmd(from),
      toYmd: toYmd(to),
    };
  }, [dateRange]);

  const normalizedDetailSearch = debouncedDetailSearch.trim();

  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    error: overviewError,
  } = useSWR(
    branchId
      ? ["reporting-sales-overview", branchId, range.fromYmd, range.toYmd]
      : null,
    async () => {
      const [
        salesTrend,
        topProducts,
        priceTypesSummary,
        pricingSourcesSummary,
      ] = await Promise.all([
        backendApi.reporting.sales.history({
          from: range.fromYmd,
          to: range.toYmd,
          groupBy: "day",
          metric: "revenue",
        }),
        backendApi.reporting.sales.topProducts.report(
          {
            from: range.fromYmd,
            to: range.toYmd,
            limit: DETAIL_PAGE_SIZE,
            branchId: branchId ?? undefined,
          },
          branchId
        ),
        backendApi.reporting.sales.priceTypes
          .summary(
            {
              from: range.fromYmd,
              to: range.toYmd,
              branchId: branchId ?? undefined,
            },
            branchId
          )
          .catch(() => null),
        backendApi.reporting.sales.pricingSources
          .summary(
            {
              from: range.fromYmd,
              to: range.toYmd,
              branchId: branchId ?? undefined,
            },
            branchId
          )
          .catch(() => null),
      ]);

      return {
        salesTrend,
        topProducts,
        priceTypesSummary,
        pricingSourcesSummary,
      };
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const {
    data: detailTopProducts,
    isLoading: isDetailLoading,
    error: detailError,
  } = useSWR(
    branchId
      ? [
          "reporting-sales-top-products-detail",
          branchId,
          range.fromYmd,
          range.toYmd,
          detailPage,
          DETAIL_PAGE_SIZE,
          normalizedDetailSearch,
        ]
      : null,
    async () =>
      backendApi.reporting.sales.topProducts.report(
        {
          from: range.fromYmd,
          to: range.toYmd,
          limit: DETAIL_PAGE_SIZE,
          page: detailPage,
          search: normalizedDetailSearch || undefined,
          branchId: branchId ?? undefined,
        },
        branchId
      ),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const {
    data: soldQuantityBreakdown,
    isLoading: isSoldQuantityBreakdownLoading,
    error: soldQuantityBreakdownError,
  } = useSWR(
    branchId
      ? [
          "reporting-sales-quantity-breakdown",
          branchId,
          range.fromYmd,
          range.toYmd,
        ]
      : null,
    async () => {
      const productTotals = new Map<
        string,
        { quantity: number; measurementType: MeasurementType | null }
      >();

      for (let page = 1; page <= MAX_METRICS_PAGES; page += 1) {
        const report = await backendApi.reporting.sales.topProducts.report(
          {
            from: range.fromYmd,
            to: range.toYmd,
            branchId: branchId ?? undefined,
            limit: METRICS_PAGE_SIZE,
            page,
          },
          branchId
        );

        const items = Array.isArray(report?.items) ? report.items : [];
        for (const item of items) {
          const productId = String(item.productId ?? "").trim();
          if (!productId) continue;

          const quantity = Number(item.unitsTotal ?? 0);
          if (!Number.isFinite(quantity) || quantity <= 0) continue;

          const existing = productTotals.get(productId);
          if (existing) {
            existing.quantity += quantity;
            existing.measurementType =
              existing.measurementType ?? getTopProductMeasurementType(item);
            continue;
          }

          productTotals.set(productId, {
            quantity,
            measurementType: getTopProductMeasurementType(item),
          });
        }

        const source = report as
          | (typeof report & {
              meta?: {
                total?: number;
                hasMore?: boolean;
              };
              total?: number;
              hasMore?: boolean;
            })
          | undefined;

        const totalFromMeta = Number(
          source?.meta?.total ?? source?.total ?? Number.NaN
        );
        if (Number.isFinite(totalFromMeta) && totalFromMeta >= 0) {
          const totalPages = Math.max(
            1,
            Math.ceil(totalFromMeta / METRICS_PAGE_SIZE)
          );
          if (page >= totalPages) break;
          continue;
        }

        const hasMore =
          typeof source?.meta?.hasMore === "boolean"
            ? source.meta.hasMore
            : typeof source?.hasMore === "boolean"
            ? source.hasMore
            : items.length >= METRICS_PAGE_SIZE;

        if (!hasMore) break;
      }

      const unresolvedProductIds = [...productTotals.entries()]
        .filter(([, value]) => !value.measurementType)
        .map(([productId]) => productId);

      for (
        let index = 0;
        index < unresolvedProductIds.length;
        index += PRODUCT_LOOKUP_BATCH_SIZE
      ) {
        const chunk = unresolvedProductIds.slice(
          index,
          index + PRODUCT_LOOKUP_BATCH_SIZE
        );
        const chunkResults = await Promise.allSettled(
          chunk.map((productId) => backendApi.products.getById(productId))
        );

        chunkResults.forEach((result, chunkIndex) => {
          if (result.status !== "fulfilled") return;

          const productId = chunk[chunkIndex];
          const measurementType =
            normalizeMeasurementType(result.value.measurementType) ??
            (result.value.isWeighable ? "kg" : "unit");

          const existing = productTotals.get(productId);
          if (!existing) return;
          existing.measurementType = measurementType;
        });
      }

      return [...productTotals.values()].reduce(
        (acc, product) => {
          const measurementType = product.measurementType;
          if (measurementType === "kg") {
            acc.kilosTotal += product.quantity;
            return acc;
          }
          if (measurementType === "gram") {
            acc.kilosTotal += product.quantity / 1000;
            return acc;
          }
          acc.unitsTotal += product.quantity;
          return acc;
        },
        {
          unitsTotal: 0,
          kilosTotal: 0,
        }
      );
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const isLoading = isOverviewLoading;
  const error = overviewError;

  const topProductsItems = useMemo(
    () => overviewData?.topProducts.items ?? [],
    [overviewData?.topProducts.items]
  );

  const priceTypesSummaryItems = useMemo<ReportsSalesPriceTypesSummaryItem[]>(
    () => overviewData?.priceTypesSummary?.items ?? [],
    [overviewData?.priceTypesSummary?.items]
  );

  const priceTypesSummaryTotals = useMemo(() => {
    const totals = overviewData?.priceTypesSummary?.totals;
    if (totals) return totals;
    if (priceTypesSummaryItems.length === 0) return null;

    return priceTypesSummaryItems.reduce(
      (acc, item) => {
        acc.unitsTotal += Number(item.unitsTotal ?? 0);
        acc.revenueTotal += Number(item.revenueTotal ?? 0);
        acc.costTotal += Number(item.costTotal ?? 0);
        acc.profitTotal += Number(item.profitTotal ?? 0);
        acc.itemCount += Number(item.itemCount ?? 0);
        acc.saleCount += Number(item.saleCount ?? item.salesCount ?? 0);
        return acc;
      },
      {
        unitsTotal: 0,
        revenueTotal: 0,
        costTotal: 0,
        profitTotal: 0,
        marginPercent: 0,
        itemCount: 0,
        saleCount: 0,
      }
    );
  }, [overviewData?.priceTypesSummary?.totals, priceTypesSummaryItems]);

  const pricingSourcesSummaryItems = useMemo<
    ReportsSalesPricingSourcesSummaryItem[]
  >(
    () => overviewData?.pricingSourcesSummary?.items ?? [],
    [overviewData?.pricingSourcesSummary?.items]
  );

  const totals = useMemo(() => {
    const seed = {
      revenueTotal: 0,
      unitsTotal: 0,
      marginTotal: 0,
      revenueRetail: 0,
      revenueWholesale: 0,
    };

    return topProductsItems.reduce((acc, item) => {
      acc.revenueTotal += Number(item.revenueTotal ?? 0);
      acc.unitsTotal += Number(item.unitsTotal ?? 0);
      acc.marginTotal += Number(item.marginTotal ?? 0);
      acc.revenueRetail += Number(item.revenueRetail ?? 0);
      acc.revenueWholesale += Number(item.revenueWholesale ?? 0);
      return acc;
    }, seed);
  }, [topProductsItems]);

  const effectiveTotals = useMemo(() => {
    if (!priceTypesSummaryTotals) return totals;
    return {
      ...totals,
      revenueTotal: Number(
        priceTypesSummaryTotals.revenueTotal ?? totals.revenueTotal
      ),
      unitsTotal: Number(
        priceTypesSummaryTotals.unitsTotal ?? totals.unitsTotal
      ),
      marginTotal: Number(
        priceTypesSummaryTotals.profitTotal ?? totals.marginTotal
      ),
    };
  }, [priceTypesSummaryTotals, totals]);

  const totalMarginPct = useMemo(() => {
    if (
      priceTypesSummaryTotals &&
      Number.isFinite(priceTypesSummaryTotals.marginPercent)
    ) {
      return Number(priceTypesSummaryTotals.marginPercent);
    }
    return effectiveTotals.revenueTotal > 0
      ? (effectiveTotals.marginTotal / effectiveTotals.revenueTotal) * 100
      : 0;
  }, [
    effectiveTotals.marginTotal,
    effectiveTotals.revenueTotal,
    priceTypesSummaryTotals,
  ]);

  const displayedSoldUnits = Number(
    soldQuantityBreakdown?.unitsTotal ?? effectiveTotals.unitsTotal
  );
  const displayedSoldKilos = Number(soldQuantityBreakdown?.kilosTotal ?? 0);

  const salesTrendData = useMemo(
    () =>
      (overviewData?.salesTrend.points ?? []).map((point) => ({
        name: format(new Date(point.period), "dd/MM", { locale: es }),
        total: Number(point.value ?? 0),
      })),
    [overviewData?.salesTrend.points]
  );

  const topProductsByPriceType = useMemo(
    () =>
      topProductsItems.map((item) => ({
        name: shortLabel(item.productName, 16),
        minorista: Number(item.revenueRetail ?? 0),
        mayorista: Number(item.revenueWholesale ?? 0),
      })),
    [topProductsItems]
  );

  const detailProductsItems = useMemo(
    () => detailTopProducts?.items ?? [],
    [detailTopProducts?.items]
  );

  const detailMeta = useMemo(() => {
    const source = detailTopProducts as
      | (typeof detailTopProducts & {
          meta?: {
            total?: number;
            limit?: number;
            hasMore?: boolean;
          };
          total?: number;
          hasMore?: boolean;
        })
      | undefined;

    const totalFromMeta = Number(
      source?.meta?.total ?? source?.total ?? Number.NaN
    );
    const hasKnownTotal = Number.isFinite(totalFromMeta) && totalFromMeta >= 0;
    const totalPages = hasKnownTotal
      ? Math.max(1, Math.ceil(totalFromMeta / DETAIL_PAGE_SIZE))
      : undefined;

    const hasMore =
      typeof source?.meta?.hasMore === "boolean"
        ? source.meta.hasMore
        : typeof source?.hasMore === "boolean"
        ? source.hasMore
        : detailProductsItems.length >= DETAIL_PAGE_SIZE;

    return {
      hasKnownTotal,
      totalItems: hasKnownTotal ? totalFromMeta : undefined,
      totalPages,
      hasMore,
    };
  }, [detailProductsItems.length, detailTopProducts]);

  const salesByPriceTypePie = useMemo(() => {
    if (priceTypesSummaryItems.length > 0) {
      const summaryByKey = new Map(
        priceTypesSummaryItems.map((item) => [
          String(item.key ?? "")
            .trim()
            .toUpperCase(),
          Number(item.revenueTotal ?? 0),
        ])
      );

      const retail = Number(summaryByKey.get("RETAIL") ?? 0);
      const wholesale = Number(summaryByKey.get("WHOLESALE") ?? 0);
      return [
        { name: "Minorista", value: retail },
        { name: "Mayorista", value: wholesale },
      ];
    }

    return [
      { name: "Minorista", value: effectiveTotals.revenueRetail },
      { name: "Mayorista", value: effectiveTotals.revenueWholesale },
    ];
  }, [
    effectiveTotals.revenueRetail,
    effectiveTotals.revenueWholesale,
    priceTypesSummaryItems,
  ]);

  const pricingSourcesCaption = useMemo(() => {
    if (pricingSourcesSummaryItems.length === 0) return null;

    const topSources = [...pricingSourcesSummaryItems]
      .sort(
        (left, right) =>
          Number(right.revenueTotal ?? 0) - Number(left.revenueTotal ?? 0)
      )
      .slice(0, 2);

    if (topSources.length === 0) return null;

    return topSources
      .map(
        (item) =>
          `${getPricingSourceLabel(String(item.key ?? ""))}: ${formatMoney(
            Number(item.revenueTotal ?? 0)
          )}`
      )
      .join(" | ");
  }, [pricingSourcesSummaryItems]);

  const tableRows = useMemo(
    () =>
      topProductsItems.map((item, index) => ({
        posicion: index + 1,
        producto: item.productName,
        categoria: item.categoryName ?? "Sin categoria",
        unidadesTotal: Number(item.unitsTotal ?? 0).toLocaleString("es-AR"),
        ingresosTotal: formatMoney(Number(item.revenueTotal ?? 0)),
        unidadesMinorista: Number(item.unitsRetail ?? 0).toLocaleString(
          "es-AR"
        ),
        ingresosMinorista: formatMoney(Number(item.revenueRetail ?? 0)),
        unidadesMayorista: Number(item.unitsWholesale ?? 0).toLocaleString(
          "es-AR"
        ),
        ingresosMayorista: formatMoney(Number(item.revenueWholesale ?? 0)),
        margen: formatMoney(Number(item.marginTotal ?? 0)),
      })),
    [topProductsItems]
  );

  const exportColumns = [
    { key: "posicion", label: "#" },
    { key: "producto", label: "Producto" },
    { key: "categoria", label: "Categoria" },
    { key: "unidadesTotal", label: "Unidades Total" },
    { key: "ingresosTotal", label: "Ingresos Total" },
    { key: "unidadesMinorista", label: "Unid. Minorista" },
    { key: "ingresosMinorista", label: "Ingresos Minorista" },
    { key: "unidadesMayorista", label: "Unid. Mayorista" },
    { key: "ingresosMayorista", label: "Ingresos Mayorista" },
    { key: "margen", label: "Margen" },
  ];

  const handleExport = (formatType: "csv" | "pdf") => {
    const payload = {
      filename: "reporte-ventas",
      title: "Reporte de Ventas",
      subtitle: `Periodo ${range.fromYmd} a ${range.toYmd}.`,
      columns: exportColumns,
      rows: tableRows,
    };

    if (formatType === "csv") {
      exportRowsToCsv(payload);
      return;
    }

    exportRowsToPdf(payload);
  };

  if (!branchId) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Selecciona una sucursal activa para ver reportes de ventas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => handleExport("csv")}
          disabled={tableRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => handleExport("pdf")}
          disabled={tableRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Ingresos Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(effectiveTotals.revenueTotal)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Cantidad vendida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">Unidades</span>
              <span className="text-xl font-bold">
                {formatQuantity(displayedSoldUnits)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">Kilos</span>
              <span className="text-xl font-bold">
                {formatQuantity(displayedSoldKilos)}
              </span>
            </div>
            {isSoldQuantityBreakdownLoading && (
              <p className="text-xs text-muted-foreground">
                Calculando desglose por medida...
              </p>
            )}
            {soldQuantityBreakdownError && (
              <p className="text-xs text-destructive">
                No se pudo separar unidades y kilos para este periodo.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Margen acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(effectiveTotals.marginTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalMarginPct.toFixed(2)}% sobre ingresos totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Productos con ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.max(
                0,
                Number(detailMeta.totalItems ?? topProductsItems.length ?? 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">
          Cargando reportes de ventas...
        </p>
      )}

      {!isLoading && error && (
        <p className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "No se pudo cargar el reporte de ventas."}
        </p>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Tendencia diaria de ingresos</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[260px] sm:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesTrendData}>
                      <XAxis
                        dataKey="name"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip cursor={{ fill: "transparent" }} />
                      <Bar
                        dataKey="total"
                        fill="#22c55e"
                        radius={[4, 4, 0, 0]}
                        barSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Participacion por tipo de precio</CardTitle>
                <CardDescription>
                  {pricingSourcesCaption
                    ? `Minorista vs mayorista. Fuentes: ${pricingSourcesCaption}`
                    : "Minorista vs mayorista"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] sm:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={salesByPriceTypePie}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        nameKey="name"
                      >
                        {salesByPriceTypePie.map((entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          formatMoney(Number(value ?? 0))
                        }
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Top productos: ingresos por minorista/mayorista
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] sm:h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsByPriceType}>
                    <XAxis
                      dataKey="name"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) =>
                        formatMoney(Number(value ?? 0))
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="minorista"
                      stackId="a"
                      fill="#0ea5e9"
                      name="Minorista"
                      radius={[0, 0, 4, 4]}
                    />
                    <Bar
                      dataKey="mayorista"
                      stackId="a"
                      fill="#6366f1"
                      name="Mayorista"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle de productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  placeholder="Buscar producto o categoria"
                  value={detailSearchInput}
                  onChange={(event) => {
                    setDetailSearchInput(event.target.value);
                    setDetailPage(1);
                  }}
                  className="sm:max-w-sm"
                />
              </div>

              {isDetailLoading && detailProductsItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Cargando detalle de productos...
                </p>
              ) : detailError ? (
                <p className="text-sm text-destructive">
                  {detailError instanceof Error
                    ? detailError.message
                    : "No se pudo cargar el detalle de productos."}
                </p>
              ) : detailProductsItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {normalizedDetailSearch
                    ? "No hay productos para el filtro ingresado."
                    : "No hay ventas para el rango seleccionado."}
                </p>
              ) : (
                <div className="space-y-2">
                  {detailProductsItems.map((item: ReportsTopProductItem) => (
                    <div
                      key={item.productId}
                      className="grid gap-2 rounded-md border p-3 text-xs sm:grid-cols-5"
                    >
                      <div className="sm:col-span-2">
                        <p className="font-semibold">{item.productName}</p>
                        <p className="text-muted-foreground">
                          {item.categoryName ?? "Sin categoria"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cantidad</p>
                        <p className="font-medium">
                          {Number(item.unitsTotal ?? 0).toLocaleString("es-AR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Minorista / Mayorista
                        </p>
                        <p className="font-medium">
                          {formatMoney(Number(item.revenueRetail ?? 0))} /{" "}
                          {formatMoney(Number(item.revenueWholesale ?? 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Margen</p>
                        <p className="font-medium">
                          {formatMoney(Number(item.marginTotal ?? 0))} (
                          {Number(item.marginPct ?? 0).toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                    <span>
                      {detailMeta.hasKnownTotal && detailMeta.totalPages
                        ? `Pagina ${detailPage} de ${detailMeta.totalPages}`
                        : `Pagina ${detailPage}`}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={detailPage <= 1}
                      onClick={() =>
                        setDetailPage((current) => Math.max(1, current - 1))
                      }
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!detailMeta.hasMore}
                      onClick={() => setDetailPage((current) => current + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
