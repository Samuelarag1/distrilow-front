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

import { useUser } from "@/components/providers/user-provider";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";
import { backendApi } from "@/lib/backend-api";
import { calculateProductMargin } from "@/lib/reports/calculate-product-margin";
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
const TOP_PRODUCTS_PAGE_SIZE = 10;

type DateRange = {
  from?: Date;
  to?: Date;
};

type ProductMeasurementMeta = {
  measurementType: MeasurementType;
  isWeighable: boolean;
  costPrice: number;
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

function normalizeMeasurementType(value: unknown): MeasurementType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "unit" ||
    normalized === "gram" ||
    normalized === "kg" ||
    normalized === "ml" ||
    normalized === "liter"
  ) {
    return normalized;
  }
  return null;
}

function resolveItemMeasurementType(
  item: ReportsTopProductItem,
  productMeta?: ProductMeasurementMeta | null
): MeasurementType {
  const source = item as ReportsTopProductItem & {
    measurementType?: string | null;
    unit?: string | null;
    isWeighable?: boolean | null;
  };

  return (
    normalizeMeasurementType(source.measurementType) ??
    normalizeMeasurementType(source.unit) ??
    productMeta?.measurementType ??
    (source.isWeighable ?? productMeta?.isWeighable ? "gram" : "unit")
  );
}

function getMeasurementLabel(measurementType: MeasurementType) {
  if (measurementType === "kg") return "kg";
  if (measurementType === "gram") return "grs";
  if (measurementType === "ml") return "ml";
  if (measurementType === "liter") return "lts";
  return "unid.";
}

function formatQuantity(value: number, measurementType: MeasurementType) {
  const amount = Number(value ?? 0);
  const maxFractionDigits =
    measurementType === "unit" ||
    measurementType === "gram" ||
    measurementType === "ml"
      ? 0
      : 3;
  const formatted = amount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
  return `${formatted} ${getMeasurementLabel(measurementType)}`;
}

function resolveItemCostPrice(
  item: ReportsTopProductItem,
  productMeta?: ProductMeasurementMeta | null
) {
  const source = item as ReportsTopProductItem & {
    costPrice?: number | string | null;
    unitCost?: number | string | null;
    averageCost?: number | string | null;
  };

  const fromItem = Number(
    source.costPrice ?? source.unitCost ?? source.averageCost ?? Number.NaN
  );
  if (Number.isFinite(fromItem)) return fromItem;

  const fromProduct = Number(productMeta?.costPrice ?? Number.NaN);
  if (Number.isFinite(fromProduct)) return fromProduct;

  const quantitySold = Number(item.unitsTotal ?? 0);
  const fallbackCostTotal = Number(item.costTotal ?? 0);
  if (quantitySold > 0 && Number.isFinite(fallbackCostTotal)) {
    return fallbackCostTotal / quantitySold;
  }

  return 0;
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

export function SalesReport({ dateRange }: { dateRange: DateRange }) {
  const { branchId } = useUser();
  const [detailProductsSearch, setDetailProductsSearch] = useState("");
  const [detailProductsPage, setDetailProductsPage] = useState(1);

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

  const { data, isLoading, error } = useSWR(
    branchId
      ? ["reporting-sales-report", branchId, range.fromYmd, range.toYmd]
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
            limit: 300,
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

  const topProductsItems = useMemo(
    () => data?.topProducts.items ?? [],
    [data?.topProducts.items]
  );

  const productsToEnrichIds = useMemo(() => {
    const pendingIds = new Set<string>();
    topProductsItems.forEach((item) => {
      if (!item.productId) return;
      const source = item as ReportsTopProductItem & {
        measurementType?: string | null;
        unit?: string | null;
        costPrice?: number | string | null;
        unitCost?: number | string | null;
        averageCost?: number | string | null;
      };
      const measurementType =
        normalizeMeasurementType(source.measurementType) ??
        normalizeMeasurementType(source.unit);
      const costPrice = Number(
        source.costPrice ?? source.unitCost ?? source.averageCost ?? Number.NaN
      );
      const hasCostPrice = Number.isFinite(costPrice);
      if (!measurementType || !hasCostPrice) {
        pendingIds.add(item.productId);
      }
    });
    return [...pendingIds];
  }, [topProductsItems]);

  const { data: productMeasurementById } = useSWR<
    Record<string, ProductMeasurementMeta>
  >(
    branchId && productsToEnrichIds.length > 0
      ? [
          "reporting-sales-product-measurements",
          branchId,
          productsToEnrichIds.join(","),
        ]
      : null,
    async () => {
      if (!branchId || productsToEnrichIds.length === 0) return {};
      const remainingIds = new Set(productsToEnrichIds);
      const measurementsById: Record<string, ProductMeasurementMeta> = {};
      let skip = 0;
      const take = 100;
      let hasMore = true;
      let safety = 0;

      while (hasMore && remainingIds.size > 0 && safety < 200) {
        const page = await backendApi.products.list({ skip, take }, branchId);
        page.items.forEach((product) => {
          if (!remainingIds.has(product.id)) return;
          const measurementType = normalizeMeasurementType(
            product.measurementType
          );
          measurementsById[product.id] = {
            measurementType: measurementType ?? "unit",
            isWeighable: Boolean(product.isWeighable ?? false),
            costPrice: Number(product.costPrice ?? 0),
          };
          remainingIds.delete(product.id);
        });

        const currentOffset = Number(page.meta.offset ?? skip);
        const currentLimit = Number(page.meta.limit ?? take);
        skip = currentOffset + currentLimit;
        hasMore = Boolean(page.meta.hasMore);
        safety += 1;
      }

      return measurementsById;
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const priceTypesSummaryItems = useMemo<ReportsSalesPriceTypesSummaryItem[]>(
    () => data?.priceTypesSummary?.items ?? [],
    [data?.priceTypesSummary?.items]
  );

  const priceTypesSummaryTotals = useMemo(() => {
    const totals = data?.priceTypesSummary?.totals;
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
  }, [data?.priceTypesSummary?.totals, priceTypesSummaryItems]);

  const pricingSourcesSummaryItems = useMemo<
    ReportsSalesPricingSourcesSummaryItem[]
  >(
    () => data?.pricingSourcesSummary?.items ?? [],
    [data?.pricingSourcesSummary?.items]
  );

  const topProductsWithComputedMetrics = useMemo(
    () =>
      topProductsItems.map((item) => {
        const productMeta = productMeasurementById?.[item.productId] ?? null;
        const quantitySold = Number(item.unitsTotal ?? 0);
        const retailRevenue = Number(item.revenueRetail ?? 0);
        const wholesaleRevenue = Number(item.revenueWholesale ?? 0);
        const costPrice = resolveItemCostPrice(item, productMeta);
        const margin = calculateProductMargin({
          quantitySold,
          retailRevenue,
          wholesaleRevenue,
          costPrice,
        });
        return {
          ...item,
          measurementType: resolveItemMeasurementType(item, productMeta),
          costPrice,
          marginResult: margin,
        };
      }),
    [productMeasurementById, topProductsItems]
  );

  const totals = useMemo(() => {
    const seed = {
      revenueTotal: 0,
      unitsTotal: 0,
      costTotal: 0,
      marginTotal: 0,
      revenueRetail: 0,
      revenueWholesale: 0,
    };

    return topProductsWithComputedMetrics.reduce((acc, item) => {
      acc.revenueTotal += Number(item.marginResult.totalRevenue ?? 0);
      acc.unitsTotal += Number(item.unitsTotal ?? 0);
      acc.costTotal += Number(item.marginResult.totalCost ?? 0);
      acc.marginTotal += Number(item.marginResult.margin ?? 0);
      acc.revenueRetail += Number(item.revenueRetail ?? 0);
      acc.revenueWholesale += Number(item.revenueWholesale ?? 0);
      return acc;
    }, seed);
  }, [topProductsWithComputedMetrics]);

  const effectiveTotals = useMemo(() => {
    if (!priceTypesSummaryTotals) return totals;
    return {
      ...totals,
      revenueTotal: Number(priceTypesSummaryTotals.revenueTotal ?? totals.revenueTotal),
      unitsTotal: Number(priceTypesSummaryTotals.unitsTotal ?? totals.unitsTotal),
      costTotal: Number(priceTypesSummaryTotals.costTotal ?? totals.costTotal),
      marginTotal: Number(priceTypesSummaryTotals.profitTotal ?? totals.marginTotal),
    };
  }, [priceTypesSummaryTotals, totals]);

  const totalMarginPct = useMemo(
    () => {
      if (priceTypesSummaryTotals && Number.isFinite(priceTypesSummaryTotals.marginPercent)) {
        return Number(priceTypesSummaryTotals.marginPercent);
      }
      return effectiveTotals.revenueTotal > 0
        ? (effectiveTotals.marginTotal / effectiveTotals.revenueTotal) * 100
        : 0;
    },
    [effectiveTotals.marginTotal, effectiveTotals.revenueTotal, priceTypesSummaryTotals]
  );

  const salesTrendData = useMemo(
    () =>
      (data?.salesTrend.points ?? []).map((point) => ({
        name: format(new Date(point.period), "dd/MM", { locale: es }),
        total: Number(point.value ?? 0),
      })),
    [data?.salesTrend.points]
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

  const filteredProductDetails = useMemo(() => {
    const term = detailProductsSearch.trim().toLowerCase();
    if (!term) return topProductsWithComputedMetrics;
    return topProductsWithComputedMetrics.filter((item) => {
      const name = String(item.productName ?? "").toLowerCase();
      const category = String(item.categoryName ?? "").toLowerCase();
      return name.includes(term) || category.includes(term);
    });
  }, [detailProductsSearch, topProductsWithComputedMetrics]);

  const detailProductsTotalPages = useMemo(
    () =>
      Math.max(1, Math.ceil(filteredProductDetails.length / TOP_PRODUCTS_PAGE_SIZE)),
    [filteredProductDetails.length]
  );

  const currentDetailProductsPage = Math.min(
    detailProductsPage,
    detailProductsTotalPages
  );

  const paginatedProductDetails = useMemo(() => {
    const start = (currentDetailProductsPage - 1) * TOP_PRODUCTS_PAGE_SIZE;
    const end = start + TOP_PRODUCTS_PAGE_SIZE;
    return filteredProductDetails.slice(start, end);
  }, [currentDetailProductsPage, filteredProductDetails]);

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
  }, [effectiveTotals.revenueRetail, effectiveTotals.revenueWholesale, priceTypesSummaryItems]);

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
      topProductsWithComputedMetrics.map((item, index) => ({
        posicion: index + 1,
        producto: item.productName,
        categoria: item.categoryName ?? "Sin categoria",
        unidadesTotal: formatQuantity(
          Number(item.unitsTotal ?? 0),
          item.measurementType
        ),
        ingresosTotal: formatMoney(Number(item.marginResult.totalRevenue ?? 0)),
        unidadesMinorista: formatQuantity(
          Number(item.unitsRetail ?? 0),
          item.measurementType
        ),
        ingresosMinorista: formatMoney(Number(item.revenueRetail ?? 0)),
        unidadesMayorista: formatQuantity(
          Number(item.unitsWholesale ?? 0),
          item.measurementType
        ),
        ingresosMayorista: formatMoney(Number(item.revenueWholesale ?? 0)),
        margen: formatMoney(Number(item.marginResult.margin ?? 0)),
      })),
    [topProductsWithComputedMetrics]
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

      <p className="text-sm text-muted-foreground">
        Periodo evaluado: {format(range.from, "dd/MM/yyyy")} al{" "}
        {format(range.to, "dd/MM/yyyy")}
      </p>

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
              Unidades vendidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {effectiveTotals.unitsTotal.toLocaleString("es-AR")}
            </div>
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
            <div className="text-2xl font-bold">{topProductsItems.length}</div>
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
              <CardDescription>
                Mostrando 10 productos por pagina con buscador
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  placeholder="Buscar producto o categoria"
                  value={detailProductsSearch}
                  onChange={(event) => {
                    setDetailProductsSearch(event.target.value);
                    setDetailProductsPage(1);
                  }}
                  className="sm:max-w-sm"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Pagina {currentDetailProductsPage} de {detailProductsTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDetailProductsPage(
                        Math.max(1, currentDetailProductsPage - 1)
                      )
                    }
                    disabled={currentDetailProductsPage <= 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDetailProductsPage(
                        Math.min(
                          detailProductsTotalPages,
                          currentDetailProductsPage + 1
                        )
                      )
                    }
                    disabled={currentDetailProductsPage >= detailProductsTotalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>

              {filteredProductDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {topProductsWithComputedMetrics.length === 0
                    ? "No hay ventas para el rango seleccionado."
                    : "No hay productos para el filtro ingresado."}
                </p>
              ) : (
                <div className="space-y-2">
                  {paginatedProductDetails.map((item) => {
                    return (
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
                            {formatQuantity(
                              Number(item.unitsTotal ?? 0),
                              item.measurementType
                            )}
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
                            {formatMoney(item.marginResult.margin)} (
                            {item.marginResult.marginPercent.toFixed(2)}%)
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
