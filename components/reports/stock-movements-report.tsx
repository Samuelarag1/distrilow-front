"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";
import type { MeasurementType, Movement, MovementType } from "@/lib/api-types";

const REPORTING_TIME_ZONE = "America/Argentina/Cordoba";
const PAGE_SIZE = 10;

type StockMovementHistoryRow = Movement & {
  previousStock?: number | null;
  resultingStock?: number | null;
  product?: {
    id?: string | null;
    name?: string | null;
    measurementType?: MeasurementType;
    stockBaseUnit?: MeasurementType | null;
    isWeighable?: boolean;
  } | null;
};

const MOVEMENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ADJUSTMENT", label: "Ajuste" },
  { value: "SALE", label: "Venta" },
  { value: "RETURN", label: "Devolucion" },
  { value: "LOSS", label: "Merma" },
  { value: "EXPIRED", label: "Vencido" },
  { value: "TRANSFER_IN", label: "Transferencia entrada" },
  { value: "TRANSFER_OUT", label: "Transferencia salida" },
];

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatQuantity(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-AR", {
    timeZone: REPORTING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMovementLabel(type: MovementType) {
  switch (type) {
    case "PURCHASE":
      return "Compra";
    case "SALE":
      return "Venta";
    case "TRANSFER_IN":
      return "Transferencia entrada";
    case "TRANSFER_OUT":
      return "Transferencia salida";
    case "ADJUSTMENT":
      return "Ajuste";
    case "RETURN":
      return "Devolucion";
    case "LOSS":
      return "Merma";
    case "EXPIRED":
      return "Vencido";
    default:
      return type;
  }
}

function resolveProductName(row: StockMovementHistoryRow) {
  const text = String(row.product?.name ?? "").trim();
  return text || "Producto sin nombre";
}

function resolveVariation(row: StockMovementHistoryRow) {
  const previous = Number(row.previousStock ?? Number.NaN);
  const resulting = Number(row.resultingStock ?? Number.NaN);
  if (Number.isFinite(previous) && Number.isFinite(resulting)) {
    return resulting - previous;
  }
  return null;
}

function resolveDisplayUnit(row: StockMovementHistoryRow) {
  if (row.product?.isWeighable) return "kg" as const;
  return "unidades" as const;
}

function formatQuantityWithUnit(
  value: number | null | undefined,
  unit: "kg" | "unidades"
) {
  return `${formatQuantity(value)} ${unit}`;
}

export function StockMovementsReport() {
  const { branchId } = useUser();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(() => {
    const current = new Date();
    const start = new Date(current);
    start.setDate(current.getDate() - 29);
    return toInputDate(start);
  });
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [typeFilter, setTypeFilter] = useState<string>("ADJUSTMENT");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("all");
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);

  const { data: productOptions = [] } = useSWR(
    branchId
      ? [
          "stock-movements-product-options",
          branchId,
          debouncedProductSearch.trim(),
        ]
      : null,
    async () => {
      const payload = await backendApi.products.list(
        {
          skip: 0,
          take: 20,
          search: debouncedProductSearch.trim() || undefined,
          sortBy: "name",
          sortOrder: "asc",
        } as any,
        branchId
      );

      return payload.items.map((item) => ({
        id: String(item.id),
        name: String(item.name ?? item.id),
      }));
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const { data, isLoading, error } = useSWR(
    branchId
      ? [
          "stock-movements-history",
          branchId,
          page,
          from,
          to,
          typeFilter,
          selectedProductId,
        ]
      : null,
    async () =>
      backendApi.stockMovements.history(
        {
          page,
          limit: PAGE_SIZE,
          from,
          to,
          type: typeFilter as MovementType,
          productId:
            selectedProductId !== "all" ? selectedProductId : undefined,
        } as any,
        branchId
      ),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const rows = useMemo(
    () => ((data?.items ?? []) as StockMovementHistoryRow[]),
    [data?.items]
  );
  const metaPage = Math.max(1, Number((data?.meta as any)?.page ?? page));
  const metaLimit = Math.max(1, Number((data?.meta as any)?.limit ?? PAGE_SIZE));
  const metaTotal = Math.max(0, Number(data?.meta?.total ?? 0));
  const totalPages = Math.max(
    1,
    Number((data?.meta as any)?.totalPages ?? Math.ceil(metaTotal / metaLimit) ?? 1)
  );
  const hasNextPage = Boolean(
    (data?.meta as any)?.hasNextPage ?? data?.meta?.hasMore
  );

  if (!branchId) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Selecciona una sucursal activa para ver movimientos de stock.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros de movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MOVEMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Buscar producto..."
            />
            <select
              value={selectedProductId}
              onChange={(event) => {
                setSelectedProductId(event.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todos los productos</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de movimientos de stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <p className="text-sm text-muted-foreground">
              Cargando movimientos...
            </p>
          )}

          {!isLoading && error && (
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "No se pudieron cargar los movimientos de stock."}
            </p>
          )}

          {!isLoading && !error && (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Fecha/Hora</th>
                      <th className="px-3 py-2 text-left font-medium">Producto</th>
                      <th className="px-3 py-2 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                      <th className="px-3 py-2 text-right font-medium">Stock antes</th>
                      <th className="px-3 py-2 text-right font-medium">Stock despues</th>
                      <th className="px-3 py-2 text-right font-medium">Variacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-10 text-center text-muted-foreground"
                        >
                          No hay movimientos para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const variation = resolveVariation(row);
                        const unit = resolveDisplayUnit(row);
                        return (
                          <tr key={row.id} className="border-t">
                            <td className="px-3 py-3 whitespace-nowrap">
                              {formatDateTime(row.createdAt)}
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-medium">
                                {resolveProductName(row)}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant="outline">
                                {getMovementLabel(row.type)}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              {formatQuantityWithUnit(row.quantity, unit)}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              {formatQuantityWithUnit(row.previousStock, unit)}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              {formatQuantityWithUnit(row.resultingStock, unit)}
                            </td>
                            <td
                              className={`px-3 py-3 text-right whitespace-nowrap font-medium ${
                                variation !== null && variation >= 0
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {variation === null
                                ? "-"
                                : `${variation >= 0 ? "+" : ""}${formatQuantityWithUnit(
                                    variation,
                                    unit
                                  )}`}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Pagina {metaPage} de {totalPages} · total{" "}
                  {metaTotal.toLocaleString("es-AR")} registros
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={metaPage <= 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((prev) => prev + 1)}
                    disabled={!hasNextPage}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
