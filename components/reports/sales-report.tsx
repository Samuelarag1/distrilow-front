"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Download } from "lucide-react";
import useSWR from "swr";

import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";
import { useUser } from "@/components/providers/user-provider";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import { formatReportingPeriodLabel } from "@/lib/reports/reporting-sales-history";
import { getRollingMonthRange } from "@/lib/reports/rolling-month";
import { createMonthSelection, formatMonthInputValue } from "@/lib/reports/month-selection";
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
const TOP_PRODUCTS_FETCH_LIMIT = 300;
const PRODUCT_LOOKUP_PAGE_SIZE = 100;
const PRODUCT_PRICING_BATCH_SIZE = 20;

type DateRange = {
  from?: Date;
  to?: Date;
};

type ProductPricingSnapshot = {
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
};

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
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

function formatPercent(value: number) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

function formatMonthLabel(value: string) {
  const parsed = new Date(`${String(value ?? "").trim()}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value || "-";

  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function formatMeasurementLabel(value: MeasurementType | null) {
  if (value === "kg") return "Kg";
  if (value === "gram") return "Gr";
  if (value === "liter") return "Litros";
  if (value === "ml") return "Ml";
  if (value === "unit") return "Unidad";
  return "-";
}

function formatProductQuantity(value: number, measurementType: MeasurementType | null) {
  return formatQuantity(
    value,
    measurementType === "unit" || measurementType === null ? 0 : 3
  );
}

function formatAverageTicketLikeValue(revenue: number, quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) return "-";
  return formatMoney(revenue / quantity);
}

function formatRevenueShare(value: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return "0.00%";
  return formatPercent((value / total) * 100);
}

function buildSalesExportRows(
  items: ReportsTopProductItem[],
  totalRevenue: number
) {
  return items.map((item, index) => {
    const measurementType = getTopProductMeasurementType(item);
    const unitsTotal = Number(item.unitsTotal ?? 0);
    const revenueTotal = Number(item.revenueTotal ?? 0);
    const costTotal = Number(item.costTotal ?? 0);
    const marginTotal = Number(item.marginTotal ?? 0);

    return {
      posicion: index + 1,
      producto: item.productName,
      categoria: item.categoryName ?? "Sin categoria",
      medida: formatMeasurementLabel(measurementType),
      cantidadTotal: formatProductQuantity(unitsTotal, measurementType),
      precioPromedio: formatAverageTicketLikeValue(revenueTotal, unitsTotal),
      ingresosTotal: formatMoney(revenueTotal),
      participacionIngresos: formatRevenueShare(revenueTotal, totalRevenue),
      costoTotal: formatMoney(costTotal),
      gananciaTotal: formatMoney(marginTotal),
      margenPct: formatPercent(Number(item.marginPct ?? 0)),
      cantidadMinorista: formatProductQuantity(
        Number(item.unitsRetail ?? 0),
        measurementType
      ),
      ingresosMinorista: formatMoney(Number(item.revenueRetail ?? 0)),
      cantidadMayorista: formatProductQuantity(
        Number(item.unitsWholesale ?? 0),
        measurementType
      ),
      ingresosMayorista: formatMoney(Number(item.revenueWholesale ?? 0)),
    };
  });
}

function calculateMarginPctFromConfiguredPrice(
  sellPrice: number,
  costPrice: number
) {
  if (!Number.isFinite(sellPrice) || sellPrice <= 0) return 0;
  if (!Number.isFinite(costPrice) || costPrice < 0) return 0;

  return ((sellPrice - costPrice) / sellPrice) * 100;
}

function getTopProductMarginBreakdown(
  item: ReportsTopProductItem,
  pricing?: ProductPricingSnapshot | null
) {
  if (!pricing) {
    return {
      totalPct: Number(item.marginPct ?? 0),
      retailPct: 0,
      wholesalePct: 0,
      hasConfiguredPricing: false,
    };
  }

  const unitsRetail = Number(item.unitsRetail ?? 0);
  const unitsWholesale = Number(item.unitsWholesale ?? 0);
  const unitsTotal = Number(item.unitsTotal ?? 0);

  const retailPct = calculateMarginPctFromConfiguredPrice(
    Number(pricing.retailPrice ?? 0),
    Number(pricing.costPrice ?? 0)
  );
  const wholesalePct = calculateMarginPctFromConfiguredPrice(
    Number(pricing.wholesalePrice ?? 0),
    Number(pricing.costPrice ?? 0)
  );

  const estimatedRetailRevenue = unitsRetail * Number(pricing.retailPrice ?? 0);
  const estimatedWholesaleRevenue =
    unitsWholesale * Number(pricing.wholesalePrice ?? 0);
  const estimatedTotalRevenue =
    estimatedRetailRevenue + estimatedWholesaleRevenue;
  const estimatedTotalCost = unitsTotal * Number(pricing.costPrice ?? 0);
  const totalPct =
    estimatedTotalRevenue > 0
      ? ((estimatedTotalRevenue - estimatedTotalCost) / estimatedTotalRevenue) *
        100
      : 0;

  return {
    totalPct,
    retailPct,
    wholesalePct,
    hasConfiguredPricing: true,
  };
}

export function SalesReport({ dateRange }: { dateRange: DateRange }) {
  const { branchId } = useUser();
  const { toast } = useToast();
  const [detailSearchInput, setDetailSearchInput] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const debouncedDetailSearch = useDebouncedValue(detailSearchInput, 350);
  const detailSearchAbortControllerRef = useRef<AbortController | null>(null);
  const defaultRange = useMemo(() => {
    const rollingRange = getRollingMonthRange();
    return {
      from: dateRange?.from ?? rollingRange.from,
      to: dateRange?.to ?? rollingRange.to,
    };
  }, [dateRange?.from, dateRange?.to]);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    formatMonthInputValue(defaultRange.to)
  );

  const range = useMemo(() => {
    return createMonthSelection(defaultRange.from, defaultRange.to, {
      fromMonth: selectedMonth,
      toMonth: selectedMonth,
    });
  }, [defaultRange.from, defaultRange.to, selectedMonth]);

  const normalizedDetailSearch = debouncedDetailSearch.trim();

  const handleSelectedMonthChange = (value: string) => {
    setSelectedMonth(value);
    setDetailPage(1);
  };

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
        globalMetrics,
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
        backendApi.reporting.global.metrics(
          {
            from: range.fromYmd,
            to: range.toYmd,
          },
          branchId
        ),
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
        globalMetrics,
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
    async () => {
      detailSearchAbortControllerRef.current?.abort();
      const controller = new AbortController();
      detailSearchAbortControllerRef.current = controller;

      try {
        return await backendApi.reporting.sales.topProducts.report(
          {
            from: range.fromYmd,
            to: range.toYmd,
            limit: DETAIL_PAGE_SIZE,
            page: detailPage,
            search: normalizedDetailSearch || undefined,
            branchId: branchId ?? undefined,
          },
          branchId,
          {
            signal: controller.signal,
          }
        );
      } finally {
        if (detailSearchAbortControllerRef.current === controller) {
          detailSearchAbortControllerRef.current = null;
        }
      }
    },
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
      const report = await backendApi.reporting.sales.topProducts.report(
        {
          from: range.fromYmd,
          to: range.toYmd,
          branchId: branchId ?? undefined,
          limit: TOP_PRODUCTS_FETCH_LIMIT,
        },
        branchId
      );
      const items = Array.isArray(report?.items) ? report.items : [];
      const productTotals = new Map<
        string,
        { quantity: number; measurementType: MeasurementType | null }
      >();

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

      const unresolvedProductIds = [...productTotals.entries()]
        .filter(([, value]) => !value.measurementType)
        .map(([productId]) => productId);

      if (unresolvedProductIds.length > 0) {
        const unresolvedSet = new Set(unresolvedProductIds);
        let skip = 0;

        while (unresolvedSet.size > 0) {
          const productsPage = await backendApi.products.list(
            {
              skip,
              take: PRODUCT_LOOKUP_PAGE_SIZE,
            },
            branchId
          );
          const rows = Array.isArray(productsPage.items)
            ? productsPage.items
            : [];

          for (const product of rows) {
            const productId = String(product.id ?? "").trim();
            if (!productId || !unresolvedSet.has(productId)) continue;

            const measurementType =
              normalizeMeasurementType(product.measurementType) ??
              (product.isWeighable ? "kg" : "unit");
            const existing = productTotals.get(productId);
            if (!existing) continue;

            existing.measurementType = measurementType;
            unresolvedSet.delete(productId);
          }

          const pageMeta = productsPage.meta;
          const pageLimit = Math.max(
            1,
            Number(pageMeta?.limit ?? rows.length ?? PRODUCT_LOOKUP_PAGE_SIZE)
          );
          const pageOffset = Math.max(0, Number(pageMeta?.offset ?? skip));
          const hasMore =
            typeof pageMeta?.hasMore === "boolean"
              ? pageMeta.hasMore
              : rows.length >= pageLimit;

          if (!hasMore || rows.length === 0) break;
          skip = pageOffset + pageLimit;
        }
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
          isCapped: items.length >= TOP_PRODUCTS_FETCH_LIMIT,
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

  useEffect(() => {
    return () => {
      detailSearchAbortControllerRef.current?.abort();
    };
  }, []);

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
      revenueRetail: 0,
      revenueWholesale: 0,
    };

    return topProductsItems.reduce((acc, item) => {
      acc.revenueTotal += Number(item.revenueTotal ?? 0);
      acc.unitsTotal += Number(item.unitsTotal ?? 0);
      acc.revenueRetail += Number(item.revenueRetail ?? 0);
      acc.revenueWholesale += Number(item.revenueWholesale ?? 0);
      return acc;
    }, seed);
  }, [topProductsItems]);

  const salesByPaymentMethod = useMemo(
    () => overviewData?.globalMetrics?.sales?.byPaymentMethod ?? null,
    [overviewData?.globalMetrics]
  );
  const cashSalesTotal = Number(salesByPaymentMethod?.cashTotal ?? 0);
  const transferSalesTotal = Number(salesByPaymentMethod?.transferTotal ?? 0);

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
    };
  }, [priceTypesSummaryTotals, totals]);

  const profitabilitySummary = useMemo(() => {
    if (!priceTypesSummaryTotals) return null;

    const marginTotal = Number(priceTypesSummaryTotals.profitTotal ?? 0);
    const revenueTotal = Number(
      priceTypesSummaryTotals.revenueTotal ?? effectiveTotals.revenueTotal
    );
    const marginPct = Number.isFinite(priceTypesSummaryTotals.marginPercent)
      ? Number(priceTypesSummaryTotals.marginPercent)
      : revenueTotal > 0
      ? (marginTotal / revenueTotal) * 100
      : 0;

    return {
      marginTotal,
      marginPct,
    };
  }, [effectiveTotals.revenueTotal, priceTypesSummaryTotals]);

  const displayedSoldUnits = Number(
    soldQuantityBreakdown?.unitsTotal ?? effectiveTotals.unitsTotal
  );
  const displayedSoldKilos = Number(soldQuantityBreakdown?.kilosTotal ?? 0);

  const salesTrendData = useMemo(
    () =>
      (overviewData?.salesTrend.points ?? []).map((point) => ({
        name: formatReportingPeriodLabel(point.period, "day"),
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
  const visibleTopProductIds = useMemo(
    () => [
      ...new Set(
        [...topProductsItems, ...detailProductsItems]
          .map((item) => String(item.productId ?? "").trim())
          .filter(Boolean)
      ),
    ],
    [detailProductsItems, topProductsItems]
  );
  const { data: productPricingById } = useSWR(
    branchId && visibleTopProductIds.length > 0
      ? [
          "reporting-sales-top-products-pricing",
          branchId,
          visibleTopProductIds.join("|"),
        ]
      : null,
    async () => {
      const pricingEntries: Record<string, ProductPricingSnapshot> = {};

      for (
        let index = 0;
        index < visibleTopProductIds.length;
        index += PRODUCT_PRICING_BATCH_SIZE
      ) {
        const chunk = visibleTopProductIds.slice(
          index,
          index + PRODUCT_PRICING_BATCH_SIZE
        );
        const results = await Promise.allSettled(
          chunk.map((productId) => backendApi.products.getById(productId))
        );

        results.forEach((result, chunkIndex) => {
          if (result.status !== "fulfilled") return;
          const productId = chunk[chunkIndex];
          pricingEntries[productId] = {
            costPrice: Number(result.value.costPrice ?? 0),
            retailPrice: Number(result.value.retailPrice ?? 0),
            wholesalePrice: Number(result.value.wholesalePrice ?? 0),
          };
        });
      }

      return pricingEntries;
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );
  const detailTotalItems = useMemo(() => {
    const totalFromMeta = Number(
      detailTopProducts?.meta?.total ?? detailTopProducts?.total ?? Number.NaN
    );
    if (Number.isFinite(totalFromMeta) && totalFromMeta >= 0) {
      return totalFromMeta;
    }
    return detailProductsItems.length;
  }, [
    detailProductsItems.length,
    detailTopProducts?.meta?.total,
    detailTopProducts?.total,
  ]);
  const detailTotalPages = Math.max(
    1,
    Math.ceil(detailTotalItems / DETAIL_PAGE_SIZE)
  );
  const detailPageSafe = Math.min(detailPage, detailTotalPages);

  const detailMeta = useMemo(
    () => ({
      hasKnownTotal: Number.isFinite(detailTotalItems),
      totalItems: detailTotalItems,
      totalPages: detailTotalPages,
      hasMore:
        typeof detailTopProducts?.meta?.hasMore === "boolean"
          ? detailTopProducts.meta.hasMore
          : typeof detailTopProducts?.hasMore === "boolean"
          ? detailTopProducts.hasMore
          : detailPageSafe < detailTotalPages,
      isCapped: false,
    }),
    [
      detailPageSafe,
      detailTopProducts?.hasMore,
      detailTopProducts?.meta?.hasMore,
      detailTotalItems,
      detailTotalPages,
    ]
  );

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
      topProductsItems.map((item, index) => {
        const marginBreakdown = getTopProductMarginBreakdown(
          item,
          productPricingById?.[item.productId]
        );

        return {
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
          margenPct: formatPercent(marginBreakdown.totalPct),
          margenPctMinMay: marginBreakdown.hasConfiguredPricing
            ? `${formatPercent(marginBreakdown.retailPct)} / ${formatPercent(
                marginBreakdown.wholesalePct
              )}`
            : "No disponible",
        };
      }),
    [productPricingById, topProductsItems]
  );

  const exportColumns = [
    { key: "posicion", label: "#", align: "right" as const },
    { key: "producto", label: "Producto" },
    { key: "categoria", label: "Categoria" },
    { key: "medida", label: "Medida", align: "center" as const },
    { key: "cantidadTotal", label: "Cantidad Total", align: "right" as const },
    { key: "precioPromedio", label: "Precio Promedio", align: "right" as const },
    { key: "ingresosTotal", label: "Ingresos Total", align: "right" as const },
    {
      key: "participacionIngresos",
      label: "% Ingresos",
      align: "right" as const,
    },
    { key: "costoTotal", label: "Costo Total", align: "right" as const },
    { key: "gananciaTotal", label: "Ganancia Total", align: "right" as const },
    { key: "margenPct", label: "Margen %", align: "right" as const },
    {
      key: "cantidadMinorista",
      label: "Cant. Minorista",
      align: "right" as const,
    },
    {
      key: "ingresosMinorista",
      label: "Ingresos Minorista",
      align: "right" as const,
    },
    {
      key: "cantidadMayorista",
      label: "Cant. Mayorista",
      align: "right" as const,
    },
    {
      key: "ingresosMayorista",
      label: "Ingresos Mayorista",
      align: "right" as const,
    },
  ];

  const handleExport = async (formatType: "csv" | "pdf") => {
    if (!branchId) return;

    try {
      setIsExporting(true);

      const exportItems: ReportsTopProductItem[] = [];
      const exportPageSize = 100;
      let page = 1;
      let hasMore = true;
      let exportWasCapped = false;

      while (hasMore && exportItems.length < TOP_PRODUCTS_FETCH_LIMIT) {
        const remaining = TOP_PRODUCTS_FETCH_LIMIT - exportItems.length;
        const response = await backendApi.reporting.sales.topProducts.report(
          {
            from: range.fromYmd,
            to: range.toYmd,
            limit: Math.min(exportPageSize, remaining),
            page,
            branchId: branchId ?? undefined,
          },
          branchId
        );

        const pageItems = Array.isArray(response?.items) ? response.items : [];
        exportItems.push(...pageItems);

        const pageHasMore =
          typeof response?.meta?.hasMore === "boolean"
            ? response.meta.hasMore
            : typeof response?.hasMore === "boolean"
            ? response.hasMore
            : pageItems.length >= Math.min(exportPageSize, remaining);

        if (pageHasMore && exportItems.length >= TOP_PRODUCTS_FETCH_LIMIT) {
          exportWasCapped = true;
        }

        hasMore = pageHasMore && pageItems.length > 0;
        page += 1;
      }

      const exportRows = buildSalesExportRows(
        exportItems,
        Number(effectiveTotals.revenueTotal ?? 0)
      );
      const exportSummary = [
        {
          label: "Mes",
          value: formatMonthLabel(selectedMonth),
        },
        {
          label: "Ingresos Totales",
          value: formatMoney(effectiveTotals.revenueTotal),
        },
        {
          label: "Productos Exportados",
          value: exportRows.length,
        },
        {
          label: "Unidades",
          value: formatQuantity(displayedSoldUnits),
        },
        {
          label: "Kilos",
          value: formatQuantity(displayedSoldKilos),
        },
        {
          label: "Efectivo",
          value: formatMoney(cashSalesTotal),
        },
        {
          label: "Transferencia",
          value: formatMoney(transferSalesTotal),
        },
        ...(profitabilitySummary
          ? [
              {
                label: "Rentabilidad Estimada",
                value: `${formatMoney(
                  profitabilitySummary.marginTotal
                )} (${profitabilitySummary.marginPct.toFixed(2)}%)`,
              },
            ]
          : []),
      ];

      const payload = {
        filename: `reporte-ventas-${selectedMonth}`,
        title: "Reporte de Ventas",
        subtitle: `Mes ${formatMonthLabel(selectedMonth)}. Periodo ${range.fromYmd} a ${range.toYmd}.${exportWasCapped ? ` Export limitado a ${TOP_PRODUCTS_FETCH_LIMIT} productos.` : ""}`,
        columns: exportColumns,
        rows: exportRows,
        summary: exportSummary,
        emptyMessage: "No hay productos vendidos en el mes seleccionado.",
        orientation: "landscape" as const,
      };

      if (formatType === "csv") {
        exportRowsToCsv(payload);
        return;
      }

      exportRowsToPdf(payload);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo exportar el reporte",
        description:
          error instanceof Error
            ? error.message
            : "Intenta nuevamente en unos segundos.",
      });
    } finally {
      setIsExporting(false);
    }
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
        <div className="space-y-1 sm:mr-auto">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Mes
          </p>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(event) => handleSelectedMonthChange(event.target.value)}
            className="min-w-[160px]"
          />
        </div>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => void handleExport("csv")}
          disabled={tableRows.length === 0 || isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => void handleExport("pdf")}
          disabled={tableRows.length === 0 || isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exportando..." : "Exportar PDF"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        El reporte muestra las ventas del mes seleccionado, desde{" "}
        {range.fromYmd} hasta {range.toYmd}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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
            {soldQuantityBreakdown?.isCapped && (
              <p className="text-xs text-muted-foreground">
                Desglose calculado sobre hasta {TOP_PRODUCTS_FETCH_LIMIT}{" "}
                productos.
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
              Rentabilidad estimada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profitabilitySummary
                ? formatMoney(profitabilitySummary.marginTotal)
                : "No disponible"}
            </div>
            <p className="text-xs text-muted-foreground">
              {profitabilitySummary
                ? `${profitabilitySummary.marginPct.toFixed(
                    2
                  )}% sobre ingresos totales`
                : "Se oculta cuando el detalle por producto no es confiable."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total vendido en efectivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(cashSalesTotal)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total vendido en transferencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(transferSalesTotal)}
            </div>
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
                  {detailProductsItems.map((item: ReportsTopProductItem) => {
                    const marginBreakdown = getTopProductMarginBreakdown(
                      item,
                      productPricingById?.[item.productId]
                    );

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
                            {Number(item.unitsTotal ?? 0).toLocaleString(
                              "es-AR"
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
                          <p className="text-muted-foreground">
                            Margen segun Ventas
                          </p>
                          <p className="font-medium">
                            en desarrollo
                            {/* {formatPercent(marginBreakdown.totalPct)} */}
                          </p>
                          {/* <p className="text-muted-foreground mt-1">
                            Margen % Min / May
                          </p>
                          <p className="font-medium">
                            {marginBreakdown.hasConfiguredPricing
                              ? `${formatPercent(
                                  marginBreakdown.retailPct
                                )} / ${formatPercent(
                                  marginBreakdown.wholesalePct
                                )}`
                              : "No disponible"}
                          </p> */}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                    {detailMeta.isCapped && (
                      <span className="mr-auto">
                        Mostrando hasta {TOP_PRODUCTS_FETCH_LIMIT} productos.
                      </span>
                    )}
                    <span>
                      {detailMeta.hasKnownTotal && detailMeta.totalPages
                        ? `Pagina ${detailPageSafe} de ${detailMeta.totalPages}`
                        : `Pagina ${detailPageSafe}`}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={detailPageSafe <= 1}
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
                      onClick={() =>
                        setDetailPage((current) =>
                          Math.min(detailTotalPages, current + 1)
                        )
                      }
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
