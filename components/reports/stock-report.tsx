"use client";

import { useEffect, useMemo, useState } from "react";
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
import { swrFetcher } from "@/lib/swr-fetcher";
import { backendApi } from "@/lib/backend-api";
import type {
  ReportsInventoryLowStockItem,
  ReportsInventoryLowStockResponse,
  ReportsInventorySummaryResponse,
} from "@/lib/api-types";

const CATEGORY_COLORS = [
  "#2563eb",
  "#16a34a",
  "#eab308",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#be123c",
];

type Category = {
  id: string;
  name: string;
};

type InventoryValueMode = "cost" | "retail" | "wholesale";

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

function readInventoryValue(
  summary: ReportsInventorySummaryResponse | null,
  mode: InventoryValueMode
) {
  if (!summary) return 0;
  if (mode === "cost") return Number(summary.inventoryValueCost ?? 0);
  if (mode === "wholesale") return Number(summary.inventoryValueWholesale ?? 0);
  return Number(summary.inventoryValueRetail ?? 0);
}

export function StockReport() {
  const { branchId } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [priceMode, setPriceMode] = useState<InventoryValueMode>("retail");
  const [summary, setSummary] =
    useState<ReportsInventorySummaryResponse | null>(null);
  const [lowStock, setLowStock] =
    useState<ReportsInventoryLowStockResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const normalizedSearch = debouncedSearch.trim();
  const limit = 20;

  const { data: categoriesData } = useSWR<Category[]>(
    "/categories",
    swrFetcher,
    {
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [normalizedSearch, selectedCategory]);

  useEffect(() => {
    if (!branchId) {
      setSummary(null);
      setLowStock(null);
      setError("No hay sucursal activa para consultar inventario.");
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [summaryResponse, lowStockResponse] = await Promise.all([
          backendApi.reporting.inventory.summary(
            {
              branchId,
              search: normalizedSearch || undefined,
              categoryId:
                selectedCategory !== "all" ? selectedCategory : undefined,
              lowStockThreshold: 5,
            },
            branchId,
            { signal: controller.signal }
          ),
          backendApi.reporting.inventory.lowStock(
            {
              branchId,
              search: normalizedSearch || undefined,
              categoryId:
                selectedCategory !== "all" ? selectedCategory : undefined,
              page: currentPage,
              limit,
              lowStockThreshold: 5,
            },
            branchId,
            { signal: controller.signal }
          ),
        ]);

        setSummary(summaryResponse);
        setLowStock(lowStockResponse);
      } catch (fetchError) {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        )
          return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "No se pudo cargar el reporte de inventario.";
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [branchId, normalizedSearch, selectedCategory, currentPage]);

  const categories = useMemo(
    () =>
      (categoriesData ?? [])
        .filter((category) => Boolean(category?.id) && Boolean(category?.name))
        .map((category) => ({
          value: category.id,
          label: category.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categoriesData]
  );

  const byCategoryChart = useMemo(
    () =>
      (summary?.byCategory ?? []).map((item) => ({
        name: item.categoryName ?? "Sin categoria",
        stockBajo: Number(item.lowStockTotal ?? 0),
        valor:
          priceMode === "cost"
            ? Number(item.inventoryValueCost ?? 0)
            : priceMode === "wholesale"
            ? Number(item.inventoryValueWholesale ?? 0)
            : Number(item.inventoryValueRetail ?? 0),
      })),
    [summary?.byCategory, priceMode]
  );

  const lowStockItems = useMemo(() => lowStock?.items ?? [], [lowStock?.items]);
  const totalItems = Number(lowStock?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(limit, 1)));

  const exportRows = useMemo(
    () =>
      lowStockItems.map((item: ReportsInventoryLowStockItem) => ({
        producto: item.productName,
        categoria: item.category?.name ?? "Sin categoria",
        stockActual: Number(item.stock ?? 0).toLocaleString("es-AR"),
        stockMinimo: Number(item.minStock ?? 0).toLocaleString("es-AR"),
        faltante: Number(item.shortageQty ?? 0).toLocaleString("es-AR"),
        costo: formatMoney(Number(item.costPrice ?? 0)),
        precioMinorista: formatMoney(Number(item.retailPrice ?? 0)),
        precioMayorista: formatMoney(Number(item.wholesalePrice ?? 0)),
      })),
    [lowStockItems]
  );

  const exportColumns = [
    { key: "producto", label: "Producto" },
    { key: "categoria", label: "Categoria" },
    { key: "stockActual", label: "Stock actual" },
    { key: "stockMinimo", label: "Stock minimo" },
    { key: "faltante", label: "Faltante" },
    { key: "costo", label: "Costo" },
    { key: "precioMinorista", label: "Precio minorista" },
    { key: "precioMayorista", label: "Precio mayorista" },
  ];

  const handleExport = (formatType: "csv" | "pdf") => {
    const payload = {
      filename: "reporte-inventario-low-stock",
      title: "Reporte de Inventario",
      subtitle: "Low stock paginado + resumen global por filtros.",
      columns: exportColumns,
      rows: exportRows,
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
          Selecciona una sucursal activa para ver reportes de inventario.
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
          disabled={exportRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => handleExport("pdf")}
          disabled={exportRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Buscar por producto..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todas las categorias</option>
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>

            <select
              value={priceMode}
              onChange={(event) =>
                setPriceMode(event.target.value as InventoryValueMode)
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="cost">Valorizacion por costo</option>
              <option value="retail">Valorizacion minorista</option>
              <option value="wholesale">Valorizacion mayorista</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Productos totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(summary?.productsTotal ?? 0).toLocaleString("es-AR")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stock bajo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {Number(summary?.lowStockTotal ?? 0).toLocaleString("es-AR")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Valor inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(readInventoryValue(summary, priceMode))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Unidades en stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(summary?.stockUnitsTotal ?? 0).toLocaleString("es-AR")}
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">
          Cargando reporte de inventario...
        </p>
      )}

      {!isLoading && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Stock bajo por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] sm:h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCategoryChart}>
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip />
                      <Bar
                        dataKey="stockBajo"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Valor por categoria</CardTitle>
                <CardDescription>
                  Valorizado por modo seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] sm:h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byCategoryChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        dataKey="valor"
                        nameKey="name"
                      >
                        {byCategoryChart.map((entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={
                              CATEGORY_COLORS[index % CATEGORY_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          formatMoney(Number(value ?? 0))
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lista paginada de stock bajo</CardTitle>
              <CardDescription>
                Fuente principal: response.summary para KPIs globales,
                response.items para tabla.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowStockItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay productos con stock bajo para el filtro actual.
                </p>
              ) : (
                <div className="space-y-2">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.productId}
                      className="grid gap-2 rounded-md border p-3 text-xs sm:grid-cols-6"
                    >
                      <div className="sm:col-span-2">
                        <p className="font-semibold">{item.productName}</p>
                        <p className="text-muted-foreground">
                          {item.category?.name ?? "Sin categoria"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Stock</p>
                        <p className="font-medium">
                          {Number(item.stock ?? 0).toLocaleString("es-AR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Minimo</p>
                        <p className="font-medium">
                          {Number(item.minStock ?? 0).toLocaleString("es-AR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Faltante</p>
                        <p className="font-medium text-red-600">
                          {Number(item.shortageQty ?? 0).toLocaleString(
                            "es-AR"
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Precio minorista
                        </p>
                        <p className="font-medium">
                          {formatMoney(Number(item.retailPrice ?? 0))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Pagina {lowStock?.page ?? currentPage} de {totalPages} - total
                  low stock:{" "}
                  {Number(summary?.lowStockTotal ?? 0).toLocaleString("es-AR")}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={(lowStock?.page ?? currentPage) <= 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    disabled={(lowStock?.page ?? currentPage) >= totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
