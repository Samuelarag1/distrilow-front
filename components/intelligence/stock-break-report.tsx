"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import type { CIStockBreakSortBy, CIEstimateConfidence } from "@/lib/api-types";

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

const SORT_LABELS: Record<CIStockBreakSortBy, string> = {
  FREQUENCY: "Frecuencia (más quiebres)",
  DURATION: "Duración (más días sin stock)",
  ESTIMATED_LOSS: "Pérdida estimada",
};

function confidenceBadge(c: CIEstimateConfidence) {
  const map: Record<CIEstimateConfidence, string> = {
    HIGH: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    LOW: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    INSUFFICIENT_DATA: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };
  const label: Record<CIEstimateConfidence, string> = {
    HIGH: "Alta",
    MEDIUM: "Media",
    LOW: "Baja",
    INSUFFICIENT_DATA: "Insuf.",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[c]}`}>
      {label[c]}
    </span>
  );
}

const PAGE_SIZE = 20;

export function StockBreakReport() {
  const { branchId } = useUser();
  const [sortBy, setSortBy] = useState<CIStockBreakSortBy>("ESTIMATED_LOSS");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useSWR(
    branchId ? ["ci-stock-breaks", branchId, sortBy, page] : null,
    () =>
      backendApi.commercialIntelligence.stockBreaks({
        sortBy,
        page,
        limit: PAGE_SIZE,
      }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center">
              Quiebres de Stock
              <InfoTip text="Un quiebre ocurre cuando el stock de un producto llega a cero. Se detectan movimientos de venta, ajuste, merma y transferencia de salida — no solo ventas. Se estima cuánta plata se dejó de ganar por no tener stock en ese momento." />
            </CardTitle>
            <CardDescription>
              {data ? (
                <>
                  {data.summary.totalProductsWithBreaks} productos afectados &bull;{" "}
                  {data.summary.currentlyOutOfStock} sin stock ahora &bull; Venta perdida estimada:{" "}
                  {fmt(data.summary.totalEstimatedLostRevenue)}
                </>
              ) : (
                "Episodios de stockout y venta perdida estimada"
              )}
            </CardDescription>
          </div>
          <Select
            value={sortBy}
            onValueChange={(v) => {
              setSortBy(v as CIStockBreakSortBy);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as CIStockBreakSortBy[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data?.summary.dataQuality.warning && (
          <div className="flex items-start gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-2 text-xs mt-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{data.summary.dataQuality.warning}</span>
          </div>
        )}
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
        {data && data.data.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <span className="text-sm">No se detectaron quiebres de stock en el período analizado.</span>
            <span className="text-xs">Se detectan quiebres por venta, ajuste, merma o transferencia de salida cuando el stock pasa de {">"} 0 a ≤ 0.</span>
          </div>
        )}
        {data && data.data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Producto</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Quiebres</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Días sin stock</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1 justify-end">
                        Uds. perdidas est.
                        <InfoTip text="Estimación de cuántas unidades se dejaron de vender durante los quiebres, basado en el ritmo de ventas de los 30 días anteriores a cada quiebre." />
                      </span>
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Venta perdida est.</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Ganancia perdida est.</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        Confianza
                        <InfoTip text="Qué tan confiable es el cálculo de venta perdida. Alta = muchos datos de ventas previas. Baja = pocos datos, la estimación puede no ser exacta." />
                      </span>
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Último quiebre</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((item) => (
                    <tr key={item.productId} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 font-medium max-w-48">
                        <div className="truncate" title={item.name}>{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {item.isCurrentlyBroken ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                            Sin stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            Con stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{item.breakCount}</td>
                      <td className="px-4 py-2 text-right">{item.totalStockoutDays.toFixed(0)}</td>
                      <td className="px-4 py-2 text-right">{item.estimatedLostUnits.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-red-600 dark:text-red-400 font-medium">
                        {fmt(item.estimatedLostRevenue)}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">
                        {fmt(item.estimatedLostProfit)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {confidenceBadge(item.estimateConfidence)}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {new Date(item.lastBreakStartedAt).toLocaleDateString("es-AR")}
                      </td>
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
  );
}
