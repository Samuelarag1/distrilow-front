"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Eye, Ban, Wallet } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useTransactions,
  type Sale,
} from "@/components/providers/transactions-provider";
import { SalesDetailModal } from "./sales-detail-modal";
import { useBusiness } from "@/components/providers/business-provider";
import { useToast } from "@/hooks/use-toast";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import type { PaymentMethod } from "@/lib/api-types";
import {
  getPaymentMethodLabel,
  formatWholeAmountInput,
  getSalePaymentTypeBadgeClassName,
  getSalePaymentTypeLabel,
  normalizeWholeAmountInput,
  parseWholeAmount,
} from "@/lib/sales-payments";

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function getSaleRowStatus(sale: Sale) {
  if (sale.lifecycleStatus === "CANCELLED") return "CANCELLED";
  return sale.chargeStatus;
}

function getStatusColor(status: string) {
  if (status === "PENDING") return "bg-yellow-100 text-yellow-800";
  if (status === "PARTIALLY_PAID") return "bg-orange-100 text-orange-800";
  if (status === "PAID") return "bg-green-100 text-green-800";
  return "bg-red-100 text-red-800";
}

function getStatusText(status: string) {
  if (status === "PENDING") return "Pendiente";
  if (status === "PARTIALLY_PAID") return "Parcial";
  if (status === "PAID") return "Pagada";
  return "Cancelada";
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type SalesPaymentMethodFilter = "CASH" | "TRANSFER" | "MIXTO";
type SalesPaymentFilter = "all" | SalesPaymentMethodFilter;

function matchesSalePaymentFilter(
  sale: Sale,
  filter: SalesPaymentMethodFilter | null
) {
  if (!filter) return true;
  if (filter === "CASH") return sale.paymentType === "CASH";
  if (filter === "TRANSFER") return sale.paymentType === "TRANSFER";
  return sale.paymentType === "MIXED";
}

function getSalePaymentDisplayLabel(sale: Sale) {
  if (sale.paidAmount <= Number.EPSILON) {
    return "Sin pago";
  }

  return getSalePaymentTypeLabel(sale.paymentType);
}

function getSalePendingReasonDisplay(sale: Sale | null | undefined) {
  return sale?.pendingReasonLabel ?? sale?.pendingReason;
}

export function SalesTable() {
  const { sales, isLoading, registerSalePayment, cancelSale, getSaleDetail } =
    useTransactions();
  const { businessType } = useBusiness();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<SalesPaymentFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [saleToPay, setSaleToPay] = useState<Sale | null>(null);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const pageSize = 10;
  const paymentMethodFilter =
    selectedPaymentMethod === "all" ? null : selectedPaymentMethod;

  const { data: detailSale } = useSWR(
    detailSaleId ? (["/sales", detailSaleId] as const) : null,
    () => getSaleDetail(detailSaleId as string),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );
  const { data: payDialogDetail, isLoading: isPayDialogDetailLoading } = useSWR(
    saleToPay ? (["/sales", "payment-dialog", saleToPay.id] as const) : null,
    () => getSaleDetail(saleToPay?.id as string),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );
  const isTableLoading = isLoading;
  const saleForPayment =
    saleToPay && payDialogDetail?.id === saleToPay.id
      ? payDialogDetail
      : saleToPay;

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        if (sale.businessType !== businessType) return false;
        const status = getSaleRowStatus(sale);
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch =
          query.length === 0 ||
          sale.id.toLowerCase().includes(query) ||
          String(sale.note ?? "")
            .toLowerCase()
            .includes(query) ||
          String(getSalePendingReasonDisplay(sale) ?? "")
            .toLowerCase()
            .includes(query) ||
          String(sale.pendingReason ?? "")
            .toLowerCase()
            .includes(query) ||
          String(sale.originalNotes ?? "")
            .toLowerCase()
            .includes(query);
        const matchesStatus =
          selectedStatus === "all" || selectedStatus === status;
        const matchesPaymentMethod = matchesSalePaymentFilter(
          sale,
          paymentMethodFilter
        );
        return matchesSearch && matchesStatus && matchesPaymentMethod;
      }),
    [sales, businessType, searchQuery, selectedStatus, paymentMethodFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedSales = useMemo(() => {
    const start = (currentPageSafe - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPageSafe]);

  const openPayDialog = (sale: Sale) => {
    setSaleToPay(sale);
    setPayAmount(
      sale.outstandingAmount > 0
        ? String(Math.trunc(toFiniteNumber(sale.outstandingAmount, 0)))
        : ""
    );
    setPayMethod("CASH");
    setPayReference("");
    setPayNotes("");
    setIsPayDialogOpen(true);
  };

  const handleRegisterPayment = async () => {
    if (!saleToPay) return;
    const amount = parseWholeAmount(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Monto invalido",
        description: "Ingresa un monto entero valido mayor a 0.",
      });
      return;
    }

    try {
      setIsSubmittingPayment(true);
      await registerSalePayment(saleToPay.id, {
        amount,
        method: payMethod,
        reference: payReference.trim() || undefined,
        notes: payNotes.trim() || undefined,
      });
      toast({
        title: "Pago registrado",
        description: "El pago quedo aplicado correctamente a la venta.",
      });
      setIsPayDialogOpen(false);
      setSaleToPay(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo registrar el pago",
        description: getUserFacingErrorMessage(
          error,
          "Revisa el monto y vuelve a intentarlo."
        ),
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleCancelSale = async () => {
    if (!cancelTarget) return;
    try {
      setIsCancelling(true);
      await cancelSale(cancelTarget.id);
      toast({
        title: "Venta cancelada",
        description: "La venta fue anulada correctamente.",
      });
      setCancelTarget(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo cancelar",
        description: getUserFacingErrorMessage(
          error,
          "Intenta nuevamente en unos segundos."
        ),
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle>Historial de Ventas</CardTitle>
          <Button variant="outline" size="sm" disabled>
            <Filter className="mr-2 h-4 w-4" />
            Filtros avanzados
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, nota o pendiente..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="PARTIALLY_PAID">Parcial</option>
              <option value="PAID">Pagada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
            <select
              value={selectedPaymentMethod}
              onChange={(event) => {
                setSelectedPaymentMethod(
                  event.target.value as SalesPaymentFilter
                );
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todos los pagos</option>
              <option value="CASH">Solo efectivo</option>
              <option value="TRANSFER">Solo transferencia</option>
              <option value="MIXTO">Mixto</option>
            </select>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Fecha</th>
                    <th className="text-left p-3 font-medium">Observaciones</th>
                    <th className="text-left p-3 font-medium">Total</th>
                    <th className="text-left p-3 font-medium">Pagado</th>
                    <th className="text-left p-3 font-medium">Pago</th>
                    <th className="text-left p-3 font-medium">Saldo</th>
                    <th className="text-left p-3 font-medium">Estado</th>
                    <th className="text-left p-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isTableLoading
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-3">
                            <Skeleton className="h-4 w-36" />
                          </td>
                          <td className="p-3">
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td className="p-3">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="p-3">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="p-3">
                            <Skeleton className="h-10 w-44" />
                          </td>
                          <td className="p-3">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="p-3">
                            <Skeleton className="h-6 w-24" />
                          </td>
                          <td className="p-3">
                            <Skeleton className="h-8 w-28" />
                          </td>
                        </tr>
                      ))
                    : paginatedSales.map((sale) => {
                        const rowStatus = getSaleRowStatus(sale);
                        const canPay =
                          sale.lifecycleStatus !== "CANCELLED" &&
                          sale.outstandingAmount > 0;
                        const canCancel = sale.lifecycleStatus !== "CANCELLED";

                        return (
                          <tr
                            key={sale.id}
                            className="border-t hover:bg-muted/25 transition-colors"
                          >
                            <td className="p-3 text-sm whitespace-nowrap">
                              {new Date(sale.date).toLocaleString()}
                            </td>
                            <td className="p-3">
                              <div className="max-w-[260px] space-y-1 text-sm">
                                {getSalePendingReasonDisplay(sale) ? (
                                  <p className="font-medium text-amber-700">
                                    Motivo pendiente:{" "}
                                    {getSalePendingReasonDisplay(sale)}
                                  </p>
                                ) : null}
                                {sale.note ? (
                                  <p className="text-muted-foreground">
                                    Nota: {sale.note}
                                  </p>
                                ) : null}
                                {!getSalePendingReasonDisplay(sale) && !sale.note ? (
                                  <p className="text-muted-foreground">
                                    Sin observaciones
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td className="p-3 font-semibold">
                              {formatMoney(sale.totalAmount)}
                            </td>
                            <td className="p-3">
                              {formatMoney(sale.paidAmount)}
                            </td>
                            <td className="p-3">
                              <div className="space-y-1 text-xs">
                                <Badge
                                  className={getSalePaymentTypeBadgeClassName(
                                    sale.paymentType
                                  )}
                                >
                                  {getSalePaymentDisplayLabel(sale)}
                                </Badge>
                                {sale.paymentBreakdownByMethod.card >
                                Number.EPSILON ? (
                                  <p className="text-muted-foreground">
                                    Tarjetas:{" "}
                                    {formatMoney(sale.paymentBreakdownByMethod.card)}
                                  </p>
                                ) : null}
                                {sale.paymentBreakdownByMethod.other >
                                Number.EPSILON ? (
                                  <p className="text-muted-foreground">
                                    Otros:{" "}
                                    {formatMoney(sale.paymentBreakdownByMethod.other)}
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td className="p-3">
                              {formatMoney(sale.outstandingAmount)}
                            </td>
                            <td className="p-3">
                              <Badge className={getStatusColor(rowStatus)}>
                                {getStatusText(rowStatus)}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDetailSaleId(sale.id)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openPayDialog(sale)}
                                  disabled={!canPay}
                                >
                                  <Wallet className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCancelTarget(sale)}
                                  disabled={!canCancel}
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </div>

          {!isTableLoading && filteredSales.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron ventas.
            </div>
          )}

          {!isTableLoading && filteredSales.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Pagina {currentPageSafe} de {totalPages} ({filteredSales.length}{" "}
                registros)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCurrentPage(Math.max(1, currentPageSafe - 1))
                  }
                  disabled={currentPageSafe <= 1}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPageSafe + 1))
                  }
                  disabled={currentPageSafe >= totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <SalesDetailModal
        open={Boolean(detailSaleId)}
        onOpenChange={(open) => {
          if (!open) setDetailSaleId(null);
        }}
        sale={detailSale ?? null}
      />

      <Dialog
        open={isPayDialogOpen}
        onOpenChange={(open) => {
          setIsPayDialogOpen(open);
          if (!open) {
            setSaleToPay(null);
            setPayNotes("");
          }
        }}
      >
        <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <div className="border-b bg-gradient-to-br from-emerald-500/10 via-background to-sky-500/10 p-6">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-2xl font-black tracking-tight">
                Registrar cobro pendiente
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-6">
                Revisa el detalle de la venta antes de aplicar un nuevo pago.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Venta
                </p>
                <p className="mt-2 text-sm font-bold">
                  {saleForPayment?.id ?? "-"}
                </p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Total
                </p>
                <p className="mt-2 text-xl font-black">
                  {formatMoney(saleForPayment?.totalAmount ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Pagado
                </p>
                <p className="mt-2 text-xl font-black text-emerald-600">
                  {formatMoney(saleForPayment?.paidAmount ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Saldo
                </p>
                <p className="mt-2 text-xl font-black text-orange-600">
                  {formatMoney(saleForPayment?.outstandingAmount ?? 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Detalle de la venta
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {saleForPayment?.date
                        ? new Date(saleForPayment.date).toLocaleString("es-AR")
                        : "Sin fecha disponible"}
                    </p>
                  </div>
                  <Badge
                    className={getSalePaymentTypeBadgeClassName(
                      saleForPayment?.paymentType ?? "OTHER"
                    )}
                  >
                    {saleForPayment
                      ? getSalePaymentDisplayLabel(saleForPayment)
                      : getSalePaymentTypeLabel("OTHER")}
                  </Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {isPayDialogDetailLoading &&
                  !saleForPayment?.lineItems?.length ? (
                    <p className="text-sm text-muted-foreground">
                      Cargando detalle de productos...
                    </p>
                  ) : saleForPayment?.lineItems?.length ? (
                    saleForPayment.lineItems.map((item, index) => (
                      <div
                        key={`${item.productId}-${index}`}
                        className="rounded-xl border bg-muted/20 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {item.productName || "Producto"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Cantidad: {Number(item.quantity ?? 0).toLocaleString("es-AR")}
                            </p>
                          </div>
                          <p className="font-semibold">
                            {formatMoney(
                              item.subtotal ??
                                Number(item.quantity ?? 0) *
                                  Number(item.unitPrice ?? 0)
                            )}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      La venta no tiene detalle adicional cargado.
                    </p>
                  )}
                </div>
              </div>

              {getSalePendingReasonDisplay(saleForPayment) ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Motivo del saldo pendiente
                  </p>
                  <p className="mt-1 text-sm text-amber-950">
                    {getSalePendingReasonDisplay(saleForPayment)}
                  </p>
                </div>
              ) : null}

              {saleForPayment?.note ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                    Nota de la venta
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-sky-950">
                    {saleForPayment.note}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Nuevo pago
                </h3>

                <div className="mt-4 space-y-3">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatWholeAmountInput(payAmount)}
                    onChange={(event) =>
                      setPayAmount(normalizeWholeAmountInput(event.target.value))
                    }
                    placeholder="Monto a cobrar"
                  />
                  <select
                    value={payMethod}
                    onChange={(event) =>
                      setPayMethod(event.target.value as PaymentMethod)
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="DEBIT_CARD">Debito</option>
                    <option value="CREDIT_CARD">Credito</option>
                    <option value="MERCADO_PAGO">Mercado Pago</option>
                    <option value="OTHER">Otro</option>
                  </select>
                  <Input
                    value={payReference}
                    onChange={(event) => setPayReference(event.target.value)}
                    placeholder="Referencia (opcional)"
                  />
                  <Textarea
                    value={payNotes}
                    onChange={(event) => setPayNotes(event.target.value)}
                    placeholder="Nota opcional sobre este cobro"
                    className="min-h-[110px] resize-none"
                  />
                </div>
              </div>

              {saleForPayment?.payments?.length ? (
                <div className="rounded-2xl border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Pagos ya registrados
                  </h3>
                  <div className="mt-4 space-y-2">
                    {saleForPayment.payments.map((payment, index) => (
                      <div
                        key={`${payment.id ?? index}`}
                        className="rounded-xl border bg-muted/20 p-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {getPaymentMethodLabel(payment.method)}
                            </p>
                            {payment.reference ? (
                              <p className="text-xs text-muted-foreground">
                                Ref: {payment.reference}
                              </p>
                            ) : null}
                            {payment.notes ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Nota: {payment.notes}
                              </p>
                            ) : null}
                          </div>
                          <p className="font-semibold">
                            {formatMoney(payment.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
            <p className="text-sm text-muted-foreground">
              El pago se aplicará sobre el saldo pendiente actual.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setIsPayDialogOpen(false);
                  setSaleToPay(null);
                  setPayNotes("");
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRegisterPayment}
                disabled={isSubmittingPayment}
              >
                {isSubmittingPayment ? "Registrando..." : "Registrar pago"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion realiza cancelacion logica. La venta quedara marcada
              como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelSale}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelando..." : "Confirmar cancelacion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
