"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StockSummaryResponse } from "@/lib/api-types";

interface InventoryKpisCardsProps {
  summary: StockSummaryResponse;
}

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-AR");

export function InventoryKpisCards({ summary }: InventoryKpisCardsProps) {
  const metrics = [
    {
      title: "Productos Totales",
      value: numberFormatter.format(Number(summary.products.total ?? 0)),
    },
    {
      title: "Productos Bajo Stock",
      value: numberFormatter.format(Number(summary.products.lowStock ?? 0)),
    },
    {
      title: "Valor Inventario (Costo)",
      value: currencyFormatter.format(Number(summary.inventoryValue.cost ?? 0)),
    },
    {
      title: "Valor Inventario (Minorista)",
      value: currencyFormatter.format(Number(summary.inventoryValue.retail ?? 0)),
    },
    {
      title: "Valor Inventario (Mayorista)",
      value: currencyFormatter.format(
        Number(summary.inventoryValue.wholesale ?? 0)
      ),
    },
    {
      title: "Cantidad Total Unidades",
      value: numberFormatter.format(Number(summary.quantity.total ?? 0)),
    },
    {
      title: "Categorias Totales",
      value: numberFormatter.format(Number(summary.categories.total ?? 0)),
    },
    {
      title: "Categorias con Productos",
      value: numberFormatter.format(Number(summary.categories.withProducts ?? 0)),
    },
    {
      title: "Categorias con Stock",
      value: numberFormatter.format(Number(summary.categories.withStock ?? 0)),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {metric.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
