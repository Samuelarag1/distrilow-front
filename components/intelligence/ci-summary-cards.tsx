"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Package, TrendingUp, Clock } from "lucide-react";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function CISummaryCards() {
  const { branchId } = useUser();

  const { data, isLoading } = useSWR(
    branchId ? ["ci-summary", branchId] : null,
    () => backendApi.commercialIntelligence.summary(),
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-1" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const peakHour = data.hourlyPeak.peakHour;
  const peakLabel =
    peakHour !== null ? `${String(peakHour).padStart(2, "0")}:00 - ${String(peakHour + 1).padStart(2, "0")}:00` : "—";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Productos Inactivos (30d)
          </CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.slowMovers.productsWithoutSales30d}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.slowMovers.productsDead} muertos &bull; Capital inmovilizado:{" "}
            {fmt(data.slowMovers.immobilizedValueAtCost)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Quiebres de Stock
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {data.stockBreaks.currentlyOutOfStock}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            sin stock ahora &bull; {data.stockBreaks.productsWithBreaks} con quiebres en el período
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pareto 80/20
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.pareto.paretoProductCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            productos = 80% ingresos ({data.pareto.paretoProductPct.toFixed(1)}% del catálogo)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Hora Pico
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{peakLabel}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.hourlyPeak.peakHourAvgRevenue !== null
              ? `Promedio ${fmt(data.hourlyPeak.peakHourAvgRevenue)} / día`
              : "Datos insuficientes"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
