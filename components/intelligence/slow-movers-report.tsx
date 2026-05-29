"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import type { CISlowMoverClassification, CISlowMoverItem } from "@/lib/api-types";

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

const CLASS_LABELS: Record<CISlowMoverClassification, string> = {
  ALL: "Todos",
  DEAD: "Muertos (>60d)",
  SLOW: "Lentos",
  NEVER_SOLD: "Nunca vendido",
  NEW: "Nuevo (<30d)",
  STOCKOUT: "Sin stock",
  ACTIVE: "Activos",
};

function classificationBadge(c: CISlowMoverClassification) {
  const map: Record<CISlowMoverClassification, string> = {
    DEAD: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    SLOW: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    NEVER_SOLD: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    NEW: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    STOCKOUT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    ACTIVE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    ALL: "",
  };
  const label: Record<string, string> = {
    DEAD: "Muerto",
    SLOW: "Lento",
    NEVER_SOLD: "Nunca vendido",
    NEW: "Nuevo",
    STOCKOUT: "Sin stock",
    ACTIVE: "Activo",
    ALL: "",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[c]}`}>
      {label[c]}
    </span>
  );
}

function actionBadge(action: string | null) {
  if (!action) return null;
  const map: Record<string, string> = {
    LIQUIDATE: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    DISCOUNT: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    PROMOTE: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    MONITOR: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const label: Record<string, string> = {
    LIQUIDATE: "Liquidar",
    DISCOUNT: "Descontar",
    PROMOTE: "Promocionar",
    MONITOR: "Monitorear",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[action] ?? ""}`}>
      {label[action] ?? action}
    </span>
  );
}

const PAGE_SIZE = 20;

export function SlowMoversReport() {
  const { branchId } = useUser();
  const [classification, setClassification] = useState<CISlowMoverClassification>("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useSWR(
    branchId ? ["ci-slow-movers", branchId, classification, page] : null,
    () =>
      backendApi.commercialIntelligence.slowMovers({
        classification: classification === "ALL" ? undefined : classification,
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
            Productos con baja rotación
            <InfoTip text="Productos que no se venden bien o llevan tiempo sin moverse. Tener stock inmovilizado es dinero que no trabaja. Acá podés ver qué productos necesitan descuentos, promociones o liquidación." />
          </CardTitle>
            <CardDescription>
              {data
                ? `${data.meta.totalItems} productos encontrados — ${fmt(data.summary.totalImmobilizedValueAtCost)} inmovilizado`
                : "Productos sin movimiento o con baja rotación"}
            </CardDescription>
          </div>
          <Select
            value={classification}
            onValueChange={(v) => {
              setClassification(v as CISlowMoverClassification);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CLASS_LABELS) as CISlowMoverClassification[]).map((c) => (
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
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Stock</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1 justify-end">
                        Val. costo
                        <InfoTip text="Cuánto vale el stock actual de este producto calculado al precio de costo (lo que pagaste para comprarlo)." />
                      </span>
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Última venta</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1 justify-end">
                        Días sin venta
                        <InfoTip text="Cuántos días pasaron desde la última vez que este producto se vendió." />
                      </span>
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Uds. (período)</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        Clasificación
                        <InfoTip text="Muerto = sin ventas por más de 60 días. Lento = pocas ventas en el período. Sin stock = no hay stock para vender. Nunca vendido = nunca tuvo una venta. Nuevo = producto de menos de 30 días." />
                      </span>
                    </th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        Acción sugerida
                        <InfoTip text="Liquidar = precio agresivo para sacarlo ya. Descontar = pequeño descuento para activar ventas. Promocionar = publicidad (tiene stock pero nunca vendió). Monitorear = vigilar, puede mejorar." />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((item) => (
                    <tr key={item.productId} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 font-medium max-w-48">
                        <div className="truncate" title={item.name}>{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </td>
                      <td className="px-4 py-2 text-right">{item.currentStock.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right">{fmt(item.stockValueAtCost)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {item.lastSaleAt ? new Date(item.lastSaleAt).toLocaleDateString("es-AR") : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {item.daysSinceLastSale !== null ? item.daysSinceLastSale : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">{item.unitsSoldInPeriod.toFixed(1)}</td>
                      <td className="px-4 py-2 text-center">
                        {classificationBadge(item.classification)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {actionBadge(item.suggestedAction)}
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
