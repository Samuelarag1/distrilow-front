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

type DateRange = {
  from?: Date;
  to?: Date;
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
    const marginTotal = Number(item.profitTotal ?? item.marginTotal ?? 0);
    const marginPct = Number(item.marginTotalPct ?? item.marginPct ?? 0);

    return {
      posicion: index + 1,
      producto: item.productName ?? "Sin nombre",
      categoria: item.categoryName ?? "Sin categoria",
      medida: formatMeasurementLabel(measurementType),
      cantidadTotal: formatProductQuantity(unitsTotal, measurementType),
      precioPromedio: formatAverageTicketLikeValue(revenueTotal, unitsTotal),
      ingresosTotal: formatMoney(revenueTotal),
      participacionIngresos: formatRevenueShare(revenueTotal, totalRevenue),
      costoTotal: formatMoney(costTotal),
      gananciaTotal: formatMoney(marginTotal),
      margenPct: formatPercent(marginPct),
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
    () =>
      backendApi.reporting.sales.overview(
        {
          from: range.fromYmd,
          to: range.toYmd,
          topProductsLimit: DETAIL_PAGE_SIZE,
          branchId: branchId ?? undefined,
        },
        branchId
      ),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const shouldFetchDetailProducts =
    Boolean(normalizedDetailSearch) || detailPage !== 1;

  const {
    data: detailTopProducts,
    isLoading: isDetailLoading,
    error: detailError,
  } = useSWR(
    branchId && shouldFetchDetailProducts
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
    () => overviewData?.priceTypes?.items ?? [],
    [overviewData?.priceTypes?.items]
  );

  const pricingSourcesSummaryItems = useMemo<
    ReportsSalesPricingSourcesSummaryItem[]
  >(
    () => overviewData?.pricingSources?.items ?? [],
    [overviewData?.pricingSources?.items]
  );

  const effectiveTotals = useMemo(() => {
    const overviewTotals = overviewData?.totals;
    const seed = {
      revenueTotal: Number(overviewTotals?.revenueTotal ?? 0),
      unitsTotal: Number(overviewData?.soldQuantity?.unitsTotal ?? 0),
      revenueRetail: 0,
      revenueWholesale: 0,
      costTotal: Number(overviewTotals?.costTotal ?? 0),
      grossMarginTotal: Number(overviewTotals?.grossMarginTotal ?? 0),
      grossMarginPercent: Number(overviewTotals?.grossMarginPercent ?? 0),
    };

    return topProductsItems.reduce((acc, item) => {
      acc.revenueRetail += Number(item.revenueRetail ?? 0);
      acc.revenueWholesale += Number(item.revenueWholesale ?? 0);
      return acc;
    }, seed);
  }, [overviewData?.soldQuantity?.unitsTotal, overviewData?.totals, topProductsItems]);

  const cashSalesTotal = Number(overviewData?.payments?.cashTotal ?? 0);
  const transferSalesTotal = Number(overviewData?.payments?.transferTotal ?? 0);

  const profitabilitySummary = useMemo(() => {
    return {
      marginTotal: effectiveTotals.grossMarginTotal,
      marginPct: effectiveTotals.grossMarginPercent,
      costTotal: effectiveTotals.costTotal,
    };
  }, [effectiveTotals]);

  const displayedSoldUnits = Number(overviewData?.soldQuantity?.unitsTotal ?? 0);
  const displayedSoldKilos = Number(overviewData?.soldQuantity?.kilosTotal ?? 0);

  const salesTrendData = useMemo(
    () =>
      (overviewData?.dailyRevenue.points ?? []).map((point) => ({
        name: formatReportingPeriodLabel(point.period, "day"),
        total: Number(point.value ?? 0),
      })),
    [overviewData?.dailyRevenue.points]
  );

  const topProductsByPriceType = useMemo(
    () =>
      topProductsItems.map((item) => ({
        name: shortLabel(item.productName ?? "Sin nombre", 16),
        minorista: Number(item.revenueRetail ?? 0),
        mayorista: Number(item.revenueWholesale ?? 0),
      })),
    [topProductsItems]
  );

  const detailReport = shouldFetchDetailProducts
    ? detailTopProducts
    : overviewData?.topProducts;
  const detailProductsItems = useMemo(
    () => detailReport?.items ?? [],
    [detailReport?.items]
  );
  const detailTotalItems = useMemo(() => {
    const totalFromMeta = Number(detailReport?.meta?.total ?? Number.NaN);
    if (Number.isFinite(totalFromMeta) && totalFromMeta >= 0) {
      return totalFromMeta;
    }
    return detailProductsItems.length;
  }, [
    detailReport?.meta?.total,
    detailProductsItems.length,
  ]);
  const detailTotalPages = Math.max(
    1,
    Number(detailReport?.meta?.totalPages ?? Math.ceil(detailTotalItems / DETAIL_PAGE_SIZE))
  );
  const detailPageSafe = Math.min(detailPage, detailTotalPages);

  const detailMeta = useMemo(
    () => ({
      hasKnownTotal: Number.isFinite(detailTotalItems),
      totalItems: detailTotalItems,
      totalPages: detailTotalPages,
      hasMore: detailReport?.meta?.hasMore ?? false,
      isCapped: false,
    }),
    [
      detailReport?.meta?.hasMore,
      detailTotalItems,
      detailTotalPages,
    ]
  );

  const salesByPriceTypePie = useMemo(() => {
    if (priceTypesSummaryItems.length > 0) {
      const summaryByKey = new Map(
        priceTypesSummaryItems.map((item) => [
          String(item.key ?? item.priceType ?? "")
            .trim()
            .toUpperCase(),
          Number(item.revenueTotal ?? item.revenue ?? 0),
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
          Number(right.revenueTotal ?? right.revenue ?? 0) -
          Number(left.revenueTotal ?? left.revenue ?? 0)
      )
      .slice(0, 2);

    if (topSources.length === 0) return null;

    return topSources
      .map(
        (item) =>
          `${getPricingSourceLabel(String(item.key ?? item.pricingSource ?? ""))}: ${formatMoney(
            Number(item.revenueTotal ?? item.revenue ?? 0)
          )}`
      )
      .join(" | ");
  }, [pricingSourcesSummaryItems]);

  const tableRows = useMemo(
    () =>
      topProductsItems.map((item, index) => {
        const marginPct = Number(item.marginTotalPct ?? item.marginPct ?? 0);

        return {
          posicion: index + 1,
          producto: item.productName ?? "Sin nombre",
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
          margenPct: formatPercent(marginPct),
          margenPctMinMay: `${formatPercent(
            Number(item.marginRetailPct ?? 0)
          )} / ${formatPercent(Number(item.marginWholesalePct ?? 0))}`,
        };
      }),
    [topProductsItems]
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

      while (hasMore) {
        const response = await backendApi.reporting.sales.topProducts.report(
          {
            from: range.fromYmd,
            to: range.toYmd,
            limit: exportPageSize,
            page,
            branchId: branchId ?? undefined,
          },
          branchId
        );

        const pageItems = Array.isArray(response?.items) ? response.items : [];
        exportItems.push(...pageItems);

        const meta = response.meta;
        hasMore =
          Boolean(meta?.hasMore) &&
          pageItems.length > 0 &&
          page < Number(meta?.totalPages ?? page);
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
        subtitle: `Mes ${formatMonthLabel(selectedMonth)}. Periodo ${range.fromYmd} a ${range.toYmd}.`,
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
                    const marginPct = Number(
                      item.marginTotalPct ?? item.marginPct ?? 0
                    );

                    return (
                      <div
                        key={item.productId}
                        className="grid gap-2 rounded-md border p-3 text-xs sm:grid-cols-5"
                      >
                        <div className="sm:col-span-2">
                          <p className="font-semibold">
                            {item.productName ?? "Sin nombre"}
                          </p>
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
                            {/* {formatPercent(marginPct)} */}
                            En Desarrollo
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
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
