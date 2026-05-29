"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import type { CIVelocityClassification } from "@/lib/api-types";

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors ml-1.5">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

const CLASS_LABELS: Record<CIVelocityClassification, string> = {
  ALL: "Todos",
  A: "Clase A (top 30%)",
  B: "Clase B (medio 40%)",
  C: "Clase C (bajo 30%)",
  DEAD: "Muertos (0 ventas)",
  NEVER_SOLD: "Nunca vendidos",
  NEW: "Nuevos (<30d)",
};

function classBadge(c: string) {
  const map: Record<string, string> = {
    A: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    B: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    C: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    DEAD: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    NEVER_SOLD: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    NEW: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${map[c] ?? ""}`}>
      {c}
    </span>
  );
}

const PAGE_SIZE = 20;

export function ProductVelocityReport() {
  const { branchId } = useUser();
  const [classification, setClassification] = useState<CIVelocityClassification>("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useSWR(
    branchId ? ["ci-velocity", branchId, classification, page] : null,
    () =>
      backendApi.commercialIntelligence.productVelocity({
        classification: classification === "ALL" ? undefined : classification,
        page,
        limit: PAGE_SIZE,
      }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const criticalProducts = data?.summary.criticalStockProducts ?? [];
  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {criticalProducts.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Stock crítico — menos de 7 días de cobertura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {criticalProducts.map((p) => (
                <div
                  key={p.productId}
                  className="rounded-md border border-amber-300 bg-white dark:bg-amber-950/30 px-3 py-1 text-xs"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground ml-1.5">
                    {p.currentStock.toFixed(1)} u.{" "}
                    {p.stockCoverageDays !== null ? `(${p.stockCoverageDays.toFixed(0)}d)` : ""}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center">
                Velocidad de Productos (ABC)
                <InfoTip text="Clasifica cada producto según qué tan rápido se vende. A = los que más se venden (top 20%), B = ventas intermedias, C = los que menos rotan. Muertos = sin ventas en el período." />
              </CardTitle>
              <CardDescription>
                {data
                  ? `${data.meta.totalItems} productos — período de ${data.summary.totalDaysInRange} días`
                  : "Clasificación ABC por velocidad de venta"}
              </CardDescription>
            </div>
            <Select
              value={classification}
              onValueChange={(v) => {
                setClassification(v as CIVelocityClassification);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CLASS_LABELS) as CIVelocityClassification[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CLASS_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-destructive p-6 justify-center">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Error al cargar datos</span>
            </div>
          )}
          {data && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Producto</th>
                      <th className="px-4 py-2 text-center font-medium text-muted-foreground">Clase</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Stock</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                        <span className="inline-flex items-center gap-1 justify-end">
                          Vel. efectiva/día
                          <InfoTip text="Unidades vendidas por día, contando solo los días que el producto tuvo stock disponible (ignora los días sin stock)." />
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Vel. semanal</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                        <span className="inline-flex items-center gap-1 justify-end">
                          Cobertura
                          <InfoTip text="Días estimados hasta que se agote el stock al ritmo de venta actual. Si dice 7d o menos, hay riesgo de quedarse sin stock pronto." />
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Unidades vendidas</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((item) => (
                      <tr key={item.productId} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 font-medium max-w-48">
                          <div className="flex items-center gap-1.5">
                            {item.isCriticalStock && (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            )}
                            <div className="truncate" title={item.name}>{item.name}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </td>
                        <td className="px-4 py-2 text-center">{classBadge(item.classification)}</td>
                        <td className="px-4 py-2 text-right">{item.currentStock.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right">{item.dailyVelocityEffective.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">{item.weeklyVelocity.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right">
                          {item.stockCoverageDays !== null ? (
                            <span className={item.isCriticalStock ? "text-amber-600 font-medium" : ""}>
                              {item.stockCoverageDays.toFixed(0)}d
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">{item.totalUnitsSold.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right">{fmt(item.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages} ({data.meta.totalItems} productos)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
