"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Link } from "lucide-react";
import type { Sale } from "@/components/providers/transactions-provider";
import { backendApi } from "@/lib/backend-api";

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function formatHourRange(date: Date): string {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function SalesDetailModal({
  sale,
  open,
  onOpenChange,
}: {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const nameCacheRef = useRef<Map<string, string>>(new Map());
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  const saleId = sale?.id ?? "";
  const lineItems = useMemo(() => sale?.lineItems ?? [], [sale]);
  const uniqueProductCount = new Set(lineItems.map((item) => item.productId)).size;
  const hasLinkedProducts = lineItems.some((item) => item.linkedProductId);

  const missingProductIds = useMemo(() => {
    const ids = new Set<string>();
    lineItems.forEach((item) => {
      const currentName = String(item.productName ?? "").trim();
      const isPlaceholder =
        currentName.length === 0 || currentName.toLowerCase() === "producto";
      if (isPlaceholder && item.productId) {
        ids.add(item.productId);
      }
    });
    return [...ids];
  }, [lineItems]);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromCache = () => {
      const cachedNames: Record<string, string> = {};
      lineItems.forEach((item) => {
        const cached = nameCacheRef.current.get(item.productId);
        if (cached) {
          cachedNames[item.productId] = cached;
        }
      });
      setResolvedNames(cachedNames);
    };

    const pendingIds = missingProductIds.filter(
      (productId) => !nameCacheRef.current.has(productId)
    );

    if (pendingIds.length === 0) {
      hydrateFromCache();
      return () => {
        cancelled = true;
      };
    }

    const loadMissingNames = async () => {
      const responses = await Promise.allSettled(
        pendingIds.map((productId) => backendApi.products.getById(productId))
      );

      if (cancelled) return;

      responses.forEach((response, index) => {
        if (response.status !== "fulfilled") return;
        const productName = String(response.value?.name ?? "").trim();
        if (!productName) return;
        nameCacheRef.current.set(pendingIds[index], productName);
      });

      hydrateFromCache();
    };

    void loadMissingNames();

    return () => {
      cancelled = true;
    };
  }, [lineItems, missingProductIds, saleId]);

  if (!sale) return null;

  const saleDate = new Date(sale.date);
  const saleTime = formatHourRange(saleDate);
  const dateFormatted = saleDate.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const pendingReason = String(sale.notes ?? "").trim();
  const showPendingReason =
    pendingReason.length > 0 && Number(sale.outstandingAmount ?? 0) > 0;

  const getDisplayProductName = (productId: string, providedName?: string) => {
    const rawName = String(providedName ?? "").trim();
    if (rawName.length > 0 && rawName.toLowerCase() !== "producto") {
      return rawName;
    }
    const resolved = resolvedNames[productId]?.trim();
    if (resolved) return resolved;
    return `ID ${productId.slice(0, 8)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles de Venta</DialogTitle>
          <DialogDescription>
            {dateFormatted} a las {saleTime} • ID: {sale.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">
                {formatMoney(sale.totalAmount)}
              </p>
            </div>
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="text-lg font-bold text-green-600">
                {formatMoney(sale.paidAmount)}
              </p>
            </div>
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className="text-lg font-bold text-orange-600">
                {formatMoney(sale.outstandingAmount)}
              </p>
            </div>
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-xs text-muted-foreground">Productos</p>
              <p className="text-lg font-bold">{uniqueProductCount}</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="text-muted-foreground">Estado de pago</p>
              <Badge className="mt-1">
                {sale.chargeStatus === "PAID"
                  ? "Pagada"
                  : sale.chargeStatus === "PARTIALLY_PAID"
                  ? "Parcial"
                  : "Pendiente"}
              </Badge>
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground">Método de pago</p>
              <p className="font-medium mt-1">
                {sale.paymentMethods.join(" + ") || "Sin pago"}
              </p>
            </div>
            {hasLinkedProducts && (
              <div className="text-sm">
                <p className="text-muted-foreground">Productos vinculados</p>
                <p className="text-green-600 font-medium mt-1 flex items-center gap-1">
                  <Link className="h-4 w-4" /> Sí
                </p>
              </div>
            )}
          </div>

          {showPendingReason && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Motivo de saldo pendiente
              </p>
              <p className="mt-1 text-sm text-amber-900">{pendingReason}</p>
            </div>
          )}

          {/* Line Items Table */}
          <div className="space-y-2">
            <h3 className="font-semibold">Desglose de Productos</h3>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Producto</th>
                      <th className="text-right p-3 font-medium">Cantidad</th>
                      <th className="text-right p-3 font-medium">
                        Precio Unit.
                      </th>
                      <th className="text-right p-3 font-medium">Subtotal</th>
                      <th className="text-center p-3 font-medium">Tipo</th>
                      <th className="text-center p-3 font-medium">Vinculado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lineItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center p-4 text-muted-foreground"
                        >
                          Sin productos registrados
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item, index) => {
                        const subtotal =
                          item.subtotal ?? item.quantity * item.price;
                        return (
                          <tr
                            key={`${item.productId}-${index}`}
                            className="hover:bg-muted/25 transition-colors"
                          >
                            <td className="p-3">
                              <div className="space-y-1">
                                <p className="font-medium text-sm">
                                  {getDisplayProductName(item.productId, item.productName)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.productId.slice(0, 8)}
                                </p>
                              </div>
                            </td>
                            <td className="text-right p-3 font-medium">
                              {Number(item.quantity).toFixed(
                                item.quantity % 1 !== 0 ? 2 : 0
                              )}
                            </td>
                            <td className="text-right p-3">
                              {formatMoney(item.price)}
                            </td>
                            <td className="text-right p-3 font-semibold">
                              {formatMoney(subtotal)}
                            </td>
                            <td className="text-center p-3">
                              {item.priceType ? (
                                <Badge
                                  variant="outline"
                                  className={
                                    item.priceType === "WHOLESALE"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }
                                >
                                  {item.priceType === "WHOLESALE"
                                    ? "Mayorista"
                                    : "Minorista"}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="text-center p-3">
                              {item.linkedProductId ? (
                                <div
                                  className="flex items-center justify-center gap-1"
                                  title={`Vinculado a: ${item.linkedProductId.slice(
                                    0,
                                    8
                                  )}`}
                                >
                                  <Link className="h-4 w-4 text-green-600" />
                                  <span className="text-xs text-green-600 font-medium">
                                    Sí
                                  </span>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Payments if available */}
          {sale.payments && sale.payments.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Pagos Registrados</h3>
              <div className="space-y-2">
                {sale.payments.map((payment, index) => (
                  <div
                    key={`${payment.id ?? index}`}
                    className="rounded-lg border p-3 bg-muted/25 flex justify-between items-center text-sm"
                  >
                    <span className="font-medium uppercase">
                      {payment.method}
                    </span>
                    <span className="font-semibold">
                      {formatMoney(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
