"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Eye, Ban, Wallet } from "lucide-react";
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
import { backendApi } from "@/lib/backend-api";
import type { PaymentMethod } from "@/lib/api-types";

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
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

type SalesPaymentMethodFilter = "CASH" | "TRANSFER";
type SalesPaymentFilter = "all" | SalesPaymentMethodFilter;

const PAYMENT_FILTER_LIMIT = 100;
const PAYMENT_FILTER_MAX_PAGES = 40;

async function fetchSaleIdsByPaymentMethod(method: SalesPaymentMethodFilter) {
  const saleIds = new Set<string>();
  let offset = 0;

  for (let page = 0; page < PAYMENT_FILTER_MAX_PAGES; page += 1) {
    const response = await backendApi.sales.paymentsList({
      method,
      offset,
      limit: PAYMENT_FILTER_LIMIT,
    });

    response.items.forEach((payment) => {
      const saleId = String(payment.saleId ?? "").trim();
      if (!saleId) return;
      saleIds.add(saleId);
    });

    if (!response.meta.hasMore) break;
    offset += Math.max(1, Number(response.meta.limit ?? PAYMENT_FILTER_LIMIT));
  }

  return Array.from(saleIds);
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
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const pageSize = 10;
  const paymentMethodFilter =
    selectedPaymentMethod === "all" ? null : selectedPaymentMethod;

  const {
    data: detailSale,
    isLoading: isLoadingDetailSale,
    error: detailSaleError,
  } = useSWR(
    detailSaleId ? (["/sales", detailSaleId] as const) : null,
    () => getSaleDetail(detailSaleId as string),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const {
    data: filteredSaleIdsByPaymentMethod,
    isLoading: isLoadingPaymentMethodFilter,
    error: paymentMethodFilterError,
  } = useSWR(
    paymentMethodFilter
      ? (["/sales/payments/list", paymentMethodFilter] as const)
      : null,
    ([, method]) => fetchSaleIdsByPaymentMethod(method),
    {
      revalidateOnFocus: false,
      keepPreviousData: false,
    }
  );
  const filteredSaleIdsByPaymentMethodSet = useMemo(
    () => new Set(filteredSaleIdsByPaymentMethod ?? []),
    [filteredSaleIdsByPaymentMethod]
  );
  const isPaymentMethodFilterPending =
    Boolean(paymentMethodFilter) &&
    isLoadingPaymentMethodFilter &&
    !paymentMethodFilterError &&
    !filteredSaleIdsByPaymentMethod;
  const isTableLoading = isLoading || isPaymentMethodFilterPending;

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        if (isPaymentMethodFilterPending) return false;
        if (sale.businessType !== businessType) return false;
        const status = getSaleRowStatus(sale);
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch =
          query.length === 0 ||
          sale.customerName.toLowerCase().includes(query) ||
          sale.id.toLowerCase().includes(query);
        const matchesStatus =
          selectedStatus === "all" || selectedStatus === status;
        const matchesPaymentMethod =
          !paymentMethodFilter ||
          Boolean(paymentMethodFilterError) ||
          filteredSaleIdsByPaymentMethodSet.has(sale.id);
        return matchesSearch && matchesStatus && matchesPaymentMethod;
      }),
    [
      sales,
      isPaymentMethodFilterPending,
      businessType,
      searchQuery,
      selectedStatus,
      paymentMethodFilter,
      paymentMethodFilterError,
      filteredSaleIdsByPaymentMethodSet,
    ]
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
      String(sale.outstandingAmount > 0 ? sale.outstandingAmount : "")
    );
    setPayMethod("CASH");
    setPayReference("");
    setIsPayDialogOpen(true);
  };

  const handleRegisterPayment = async () => {
    if (!saleToPay) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Monto invalido",
        description: "Ingresa un monto valido mayor a 0.",
      });
      return;
    }

    try {
      setIsSubmittingPayment(true);
      await registerSalePayment(saleToPay.id, {
        amount,
        method: payMethod,
        reference: payReference.trim() || undefined,
      });
      toast({
        title: "Pago registrado",
        description: "El pago se registro correctamente en la venta.",
      });
      setIsPayDialogOpen(false);
      setSaleToPay(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo registrar el pago",
        description: error?.message ?? "Intenta nuevamente.",
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
        description: "La venta fue cancelada de forma logica.",
      });
      setCancelTarget(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo cancelar",
        description: error?.message ?? "Intenta nuevamente.",
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
                placeholder="Buscar por cliente o ID..."
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
                setSelectedPaymentMethod(event.target.value as SalesPaymentFilter);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todos los pagos</option>
              <option value="CASH">Solo efectivo</option>
              <option value="TRANSFER">Solo transferencia</option>
            </select>
          </div>

          {paymentMethodFilterError && (
            <p className="text-xs text-destructive">
              No se pudo aplicar el filtro por metodo de pago. Se muestran todas
              las ventas.
            </p>
          )}

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Fecha</th>
                    <th className="text-left p-3 font-medium">Cliente</th>
                    <th className="text-left p-3 font-medium">Total</th>
                    <th className="text-left p-3 font-medium">Pagado</th>
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
                            <td className="p-3 font-medium">
                              {sale.customerName}
                            </td>
                            <td className="p-3 font-semibold">
                              {formatMoney(sale.totalAmount)}
                            </td>
                            <td className="p-3">
                              {formatMoney(sale.paidAmount)}
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
          if (!open) setSaleToPay(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Venta: {saleToPay?.id}. Saldo pendiente:{" "}
              {formatMoney(saleToPay?.outstandingAmount ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={payAmount}
              onChange={(event) => setPayAmount(event.target.value)}
              placeholder="Monto"
            />
            <select
              value={payMethod}
              onChange={(event) =>
                setPayMethod(event.target.value as PaymentMethod)
              }
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPayDialogOpen(false);
                setSaleToPay(null);
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
