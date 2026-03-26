"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, CalendarClock, RefreshCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";
import { backendApi } from "@/lib/backend-api";
import type { StockLot } from "@/lib/api-types";

type CategoryOption = {
  value: string;
  label: string;
};

type ProductOption = {
  id: string;
  name: string;
  sku?: string | null;
  categoryName?: string | null;
};

type InventoryLotsSectionProps = {
  branchId: string | null;
  categories: CategoryOption[];
};

const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 20;

function normalizeLotStatus(lot: StockLot): "expired" | "today" | "upcoming" | "other" {
  const raw = String(lot.status ?? "")
    .trim()
    .toLowerCase();
  const days = Number(lot.daysUntilExpiry ?? Number.NaN);

  if (raw.includes("expired") || Number.isFinite(days) && days < 0) return "expired";
  if (raw.includes("today") || Number.isFinite(days) && days === 0) return "today";
  if (raw.includes("upcoming") || Number.isFinite(days) && days > 0) return "upcoming";
  return "other";
}

function getStatusLabel(status: ReturnType<typeof normalizeLotStatus>) {
  if (status === "expired") return "Vencido";
  if (status === "today") return "Vence hoy";
  if (status === "upcoming") return "Proximo";
  return "Sin estado";
}

function getStatusBadgeClass(status: ReturnType<typeof normalizeLotStatus>) {
  if (status === "expired") return "border-red-300 bg-red-50 text-red-700";
  if (status === "today") return "border-amber-300 bg-amber-50 text-amber-700";
  if (status === "upcoming") return "border-sky-300 bg-sky-50 text-sky-700";
  return "border-slate-300 bg-slate-50 text-slate-600";
}

function formatExpiryDate(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-AR");
}

function formatDaysUntil(daysUntilExpiry: unknown) {
  const value = Number(daysUntilExpiry);
  if (!Number.isFinite(value)) return "-";
  if (value < 0) return `Vencio hace ${Math.abs(value)}d`;
  if (value === 0) return "Vence hoy";
  if (value === 1) return "1 dia";
  return `${value} dias`;
}

function buildProductOptionFromUnknown(item: unknown): ProductOption | null {
  if (!item || typeof item !== "object") return null;
  const value = item as {
    id?: unknown;
    name?: unknown;
    sku?: unknown;
    categoryName?: unknown;
  };
  if (typeof value.id !== "string" || !value.id.trim()) return null;
  if (typeof value.name !== "string" || !value.name.trim()) return null;
  return {
    id: value.id,
    name: value.name,
    sku: typeof value.sku === "string" ? value.sku : null,
    categoryName: typeof value.categoryName === "string" ? value.categoryName : null,
  };
}

function useProductSuggestions(branchId: string | null, query: string) {
  const normalizedQuery = query.trim();
  return useSWR<ProductOption[]>(
    branchId && normalizedQuery.length >= 2
      ? ["stock-lots-product-suggestions", branchId, normalizedQuery]
      : null,
    async () => {
      const response = await backendApi.productsWithStock(
        {
          skip: 0,
          take: 8,
          name: normalizedQuery,
          q: normalizedQuery,
          search: normalizedQuery,
          sortBy: "name",
          sortOrder: "asc",
        },
        branchId
      );

      return response.items
        .map((item) => buildProductOptionFromUnknown(item))
        .filter((item): item is ProductOption => Boolean(item));
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );
}

export function InventoryLotsSection({
  branchId,
  categories,
}: InventoryLotsSectionProps) {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filterProductQuery, setFilterProductQuery] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [days, setDays] = useState(String(DEFAULT_DAYS));
  const [includeExpired, setIncludeExpired] = useState(false);
  const [onlyPositive, setOnlyPositive] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(DEFAULT_LIMIT);

  const [formProductQuery, setFormProductQuery] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formProductLabel, setFormProductLabel] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedFilterProductQuery = useDebouncedValue(filterProductQuery, 300);
  const debouncedFormProductQuery = useDebouncedValue(formProductQuery, 300);

  const { data: filterProductSuggestions = [] } = useProductSuggestions(
    branchId,
    debouncedFilterProductQuery
  );
  const { data: formProductSuggestions = [] } = useProductSuggestions(
    branchId,
    debouncedFormProductQuery
  );

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    filterProductId,
    categoryId,
    days,
    includeExpired,
    onlyPositive,
  ]);

  const safeDays = Math.max(0, Math.trunc(Number(days)) || 0);
  const normalizedSearch = debouncedSearch.trim();
  const lotsFilters = useMemo(
    () => ({
      search: normalizedSearch || undefined,
      productId: filterProductId || undefined,
      categoryId: categoryId !== "all" ? categoryId : undefined,
      days: safeDays,
      includeExpired,
      onlyPositive,
      page,
      limit,
    }),
    [
      normalizedSearch,
      filterProductId,
      categoryId,
      safeDays,
      includeExpired,
      onlyPositive,
      page,
      limit,
    ]
  );

  const {
    data: lotsResponse,
    isLoading,
    error,
    mutate: mutateLots,
    isValidating,
  } = useSWR(
    branchId
      ? ["stock-lots", branchId, lotsFilters]
      : null,
    () =>
      backendApi.stocks.lots.list(
        lotsFilters,
        branchId
      ),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );

  const lots = useMemo(() => {
    const source = lotsResponse?.items ?? [];
    const priority = {
      expired: 0,
      today: 1,
      upcoming: 2,
      other: 3,
    } as const;

    return [...source].sort((left, right) => {
      const leftStatus = normalizeLotStatus(left);
      const rightStatus = normalizeLotStatus(right);
      const byPriority = priority[leftStatus] - priority[rightStatus];
      if (byPriority !== 0) return byPriority;

      const leftDays = Number(left.daysUntilExpiry ?? Number.POSITIVE_INFINITY);
      const rightDays = Number(right.daysUntilExpiry ?? Number.POSITIVE_INFINITY);
      if (leftDays !== rightDays) return leftDays - rightDays;

      const leftName = left.product?.name ?? "";
      const rightName = right.product?.name ?? "";
      return leftName.localeCompare(rightName);
    });
  }, [lotsResponse?.items]);

  const summary = useMemo(() => {
    const seed = {
      expired: 0,
      today: 0,
      upcoming: 0,
    };

    lots.forEach((lot) => {
      const status = normalizeLotStatus(lot);
      if (status === "expired") seed.expired += 1;
      if (status === "today") seed.today += 1;
      if (status === "upcoming") seed.upcoming += 1;
    });

    return seed;
  }, [lots]);

  const totalLots = Number(lotsResponse?.meta?.total ?? lots.length);
  const totalPages = Math.max(
    1,
    Number(lotsResponse?.meta?.totalPages ?? Math.ceil(totalLots / Math.max(1, limit)))
  );

  const resetForm = () => {
    setLotCode("");
    setExpiresAt("");
    setQuantity("0");
    setNotes("");
  };

  const handleSaveLot = async () => {
    const normalizedProductId = formProductId.trim();
    const normalizedLotCode = lotCode.trim();
    const normalizedExpiresAt = expiresAt.trim();
    const parsedQuantity = Number(quantity);

    if (!normalizedProductId) {
      toast({
        variant: "destructive",
        title: "Producto obligatorio",
        description: "Selecciona un producto para guardar el lote.",
      });
      return;
    }
    if (!normalizedLotCode) {
      toast({
        variant: "destructive",
        title: "Lote obligatorio",
        description: "Ingresa el codigo de lote.",
      });
      return;
    }
    if (!normalizedExpiresAt) {
      toast({
        variant: "destructive",
        title: "Vencimiento obligatorio",
        description: "Ingresa una fecha de vencimiento valida.",
      });
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      toast({
        variant: "destructive",
        title: "Cantidad invalida",
        description: "La cantidad debe ser mayor o igual a 0.",
      });
      return;
    }

    try {
      setIsSaving(true);
      await backendApi.stocks.lots.create(
        {
          productId: normalizedProductId,
          lotCode: normalizedLotCode,
          expiresAt: normalizedExpiresAt,
          quantity: parsedQuantity,
          notes: notes.trim() || undefined,
        },
        branchId
      );

      toast({
        title: "Lote guardado",
        description: "Se registro/actualizo el lote correctamente.",
      });

      resetForm();
      await mutateLots();
    } catch (saveError) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar el lote",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Intenta nuevamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!branchId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lotes y vencimientos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Selecciona una sucursal activa para gestionar lotes.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Lotes y vencimientos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Control operativo de productos por lote y proximidad de vencimiento.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void mutateLots()}
            disabled={isLoading || isValidating}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vencidos
              </p>
              <p className="mt-1 text-2xl font-black text-red-600">
                {summary.expired}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vencen hoy
              </p>
              <p className="mt-1 text-2xl font-black text-amber-600">
                {summary.today}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-sky-500">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Proximos ({safeDays} dias)
              </p>
              <p className="mt-1 text-2xl font-black text-sky-600">
                {summary.upcoming}
              </p>
            </CardContent>
          </Card>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="lot-search">Buscar en lotes</Label>
            <Input
              id="lot-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Producto, SKU, lote o notas"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lot-days">Dias</Label>
            <Input
              id="lot-days"
              type="number"
              min={0}
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="lot-category">Categoria</Label>
            <select
              id="lot-category"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="all">Todas</option>
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="lot-product-search">Filtro por producto</Label>
            <Input
              id="lot-product-search"
              value={filterProductQuery}
              onChange={(event) => setFilterProductQuery(event.target.value)}
              placeholder="Escribe para buscar y seleccionar producto"
            />
            {filterProductSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filterProductSuggestions.map((product) => (
                  <Button
                    key={product.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFilterProductId(product.id);
                      setFilterProductQuery(product.name);
                    }}
                  >
                    {product.name}
                    {product.sku ? ` (${product.sku})` : ""}
                  </Button>
                ))}
              </div>
            )}
            {filterProductId && (
              <Badge variant="secondary" className="gap-2">
                productId: {filterProductId}
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => {
                    setFilterProductId("");
                    setFilterProductQuery("");
                  }}
                >
                  x
                </button>
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 rounded-md border bg-muted/20 px-3 py-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={includeExpired}
              onCheckedChange={(checked) => setIncludeExpired(checked === true)}
            />
            Incluir vencidos
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={onlyPositive}
              onCheckedChange={(checked) => setOnlyPositive(checked === true)}
            />
            Solo cantidad positiva
          </label>
        </div>

        <div className="space-y-3 rounded-md border p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Alta/actualizacion manual de lote</h3>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="new-lot-product">Producto</Label>
              <Input
                id="new-lot-product"
                value={formProductQuery}
                onChange={(event) => setFormProductQuery(event.target.value)}
                placeholder="Busca por nombre, SKU o codigo"
              />
              {formProductSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formProductSuggestions.map((product) => (
                    <Button
                      key={product.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFormProductId(product.id);
                        setFormProductLabel(product.name);
                        setFormProductQuery(product.name);
                      }}
                    >
                      {product.name}
                      {product.sku ? ` (${product.sku})` : ""}
                    </Button>
                  ))}
                </div>
              )}
              {formProductId && (
                <Badge variant="secondary">
                  Producto seleccionado: {formProductLabel || formProductId}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-lot-code">Lote</Label>
              <Input
                id="new-lot-code"
                value={lotCode}
                onChange={(event) => setLotCode(event.target.value)}
                placeholder="Ej: LOTE-2026-03"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-lot-expires">Vencimiento</Label>
              <Input
                id="new-lot-expires"
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-lot-quantity">Cantidad</Label>
              <Input
                id="new-lot-quantity"
                type="number"
                min={0}
                step="0.001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="new-lot-notes">Notas (opcional)</Label>
              <Textarea
                id="new-lot-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observaciones del lote"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void handleSaveLot()} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Guardando..." : "Guardar lote"}
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`lot-skeleton-${index}`} className="h-14 w-full" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <p>
              {error instanceof Error
                ? error.message
                : "No se pudieron cargar los lotes."}
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                {totalLots === 0
                  ? "Sin resultados para los filtros seleccionados."
                  : `Mostrando ${lots.length} registros de ${totalLots} totales.`}
              </p>
              <p>
                Pagina {page} de {totalPages}
              </p>
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => {
                    const status = normalizeLotStatus(lot);
                    return (
                      <TableRow
                        key={lot.id}
                        className={
                          status === "expired"
                            ? "bg-red-50/50"
                            : status === "today"
                            ? "bg-amber-50/50"
                            : status === "upcoming"
                            ? "bg-sky-50/40"
                            : undefined
                        }
                      >
                        <TableCell className="font-medium">
                          {lot.product?.name ?? lot.productId}
                        </TableCell>
                        <TableCell>{lot.product?.sku ?? "-"}</TableCell>
                        <TableCell>{lot.lotCode || "-"}</TableCell>
                        <TableCell>{formatExpiryDate(lot.expiresAt)}</TableCell>
                        <TableCell>{formatDaysUntil(lot.daysUntilExpiry)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getStatusBadgeClass(status)}
                          >
                            {getStatusLabel(status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(lot.quantity ?? 0).toLocaleString("es-AR")}
                        </TableCell>
                        <TableCell>{lot.product?.categoryName ?? "-"}</TableCell>
                        <TableCell className="max-w-[260px] truncate">
                          {lot.notes?.trim() ? lot.notes : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {lots.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No hay lotes para los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {lots.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No hay lotes para los filtros seleccionados.
                </div>
              ) : (
                lots.map((lot) => {
                  const status = normalizeLotStatus(lot);
                  return (
                    <Card
                      key={`lot-mobile-${lot.id}`}
                      className={
                        status === "expired"
                          ? "border-l-4 border-l-red-500"
                          : status === "today"
                          ? "border-l-4 border-l-amber-500"
                          : status === "upcoming"
                          ? "border-l-4 border-l-sky-500"
                          : undefined
                      }
                    >
                      <CardContent className="space-y-2 p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">
                            {lot.product?.name ?? lot.productId}
                          </p>
                          <Badge
                            variant="outline"
                            className={getStatusBadgeClass(status)}
                          >
                            {getStatusLabel(status)}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          SKU: {lot.product?.sku ?? "-"}
                        </p>
                        <p>Lote: {lot.lotCode || "-"}</p>
                        <p>Vencimiento: {formatExpiryDate(lot.expiresAt)}</p>
                        <p>Dias: {formatDaysUntil(lot.daysUntilExpiry)}</p>
                        <p>Cantidad: {Number(lot.quantity ?? 0).toLocaleString("es-AR")}</p>
                        <p>Categoria: {lot.product?.categoryName ?? "-"}</p>
                        <p>Notas: {lot.notes?.trim() ? lot.notes : "-"}</p>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
