"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAudit } from "@/components/providers/audit-provider";
import { useTransactions } from "@/components/providers/transactions-provider";
import { useBusiness } from "@/components/providers/business-provider";
import { useProducts } from "@/components/providers/product-provider";
import { useUser } from "@/components/providers/user-provider";
import { Button } from "@/components/ui/button";
import {
  History,
  Users,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  User as UserIcon,
  ShieldCheck,
  Download,
  CalendarDays,
  RefreshCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { backendApi } from "@/lib/backend-api";
import type { CashSession } from "@/lib/api-types";
import type { AuditEvent } from "@/components/providers/audit-provider";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";

type MovementSummary = {
  movementType?: string;
  branchId?: string;
  quantity?: number;
  productId?: string;
  resultingStock?: number;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return null;
}

function readString(input: Record<string, unknown> | null, keys: string[]) {
  if (!input) return undefined;
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(input: Record<string, unknown> | null, keys: string[]) {
  if (!input) return undefined;
  for (const key of keys) {
    const value = input[key];
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractMovementSummary(event: AuditEvent): MovementSummary | null {
  const metadata = toRecord(event.metadata);
  const oldValue = toRecord(metadata?.oldValue);
  const newValue = toRecord(metadata?.newValue);

  const movementType =
    readString(metadata, ["type", "movementType"]) ??
    readString(newValue, ["type", "movementType"]);
  const branchId =
    readString(metadata, ["branchId"]) ?? readString(newValue, ["branchId"]);
  const quantity =
    readNumber(metadata, ["quantity", "delta"]) ??
    readNumber(newValue, ["quantity"]);
  const productId =
    readString(metadata, ["productId"]) ??
    readString(newValue, ["productId"]) ??
    readString(oldValue, ["productId"]);
  const resultingStock =
    readNumber(metadata, ["resultingStock", "stock"]) ??
    readNumber(newValue, ["resultingStock", "stock", "quantity"]);

  if (
    !movementType &&
    !branchId &&
    quantity === undefined &&
    !productId &&
    resultingStock === undefined
  ) {
    return null;
  }

  return {
    movementType,
    branchId,
    quantity,
    productId,
    resultingStock,
  };
}

export function ReportsModule() {
  const { events, isLoading, error } = useAudit();
  const { sales } = useTransactions();
  const { businessType } = useBusiness();
  const { products } = useProducts({ take: 500, skip: 0 });
  const { branchId } = useUser();

  const [activeTab, setActiveTab] = useState("audit");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState<string | null>(null);

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((product) => {
      map.set(product.id, product.name);
    });
    return map;
  }, [products]);

  const currentSales = sales.filter((sale) => sale.businessType === businessType);

  const salesByCashier = currentSales.reduce((acc, sale) => {
    if (!acc[sale.userName]) {
      acc[sale.userName] = { total: 0, count: 0 };
    }
    acc[sale.userName].total += sale.amount;
    acc[sale.userName].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const auditIcons: Record<string, ReactNode> = {
    create: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    update: <Clock className="h-4 w-4 text-blue-500" />,
    delete: <AlertCircle className="h-4 w-4 text-red-500" />,
    adjust_stock: <Package className="h-4 w-4 text-orange-500" />,
    login: <ShieldCheck className="h-4 w-4 text-purple-500" />,
    logout: <ShieldCheck className="h-4 w-4 text-gray-500" />,
    close_cashbox: <DollarSign className="h-4 w-4 text-emerald-500" />,
  };

  const eventTypes = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.action))).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (eventTypeFilter === "all") return events;
    return events.filter((event) => event.action === eventTypeFilter);
  }, [events, eventTypeFilter]);

  const cashierRows = useMemo(
    () =>
      Object.entries(salesByCashier).map(([name, data]) => ({
        cajero: name,
        totalVendido: Number(data.total).toLocaleString("es-AR", {
          style: "currency",
          currency: "ARS",
        }),
        operaciones: data.count,
        ticketPromedio: Number(data.total / data.count).toLocaleString("es-AR", {
          style: "currency",
          currency: "ARS",
        }),
      })),
    [salesByCashier]
  );

  const cashDailyRows = useMemo(
    () =>
      cashSessions
        .slice()
        .sort(
          (a, b) =>
            new Date(b.openedAt ?? 0).getTime() - new Date(a.openedAt ?? 0).getTime()
        )
        .map((session) => ({
          fecha: session.openedAt
            ? new Date(session.openedAt).toLocaleDateString()
            : "Sin fecha",
          apertura: session.openedAt
            ? new Date(session.openedAt).toLocaleTimeString()
            : "-",
          cierre: session.closedAt
            ? new Date(session.closedAt).toLocaleTimeString()
            : "Abierta",
          fondoInicial: Number(session.openingFloat ?? 0).toLocaleString("es-AR", {
            style: "currency",
            currency: "ARS",
          }),
          esperado: Number(session.expectedCash ?? 0).toLocaleString("es-AR", {
            style: "currency",
            currency: "ARS",
          }),
          contado:
            session.countedCash === undefined || session.countedCash === null
              ? "-"
              : Number(session.countedCash).toLocaleString("es-AR", {
                  style: "currency",
                  currency: "ARS",
                }),
          diferencia:
            session.difference === undefined || session.difference === null
              ? "-"
              : Number(session.difference).toLocaleString("es-AR", {
                  style: "currency",
                  currency: "ARS",
                }),
          estado: session.status,
        })),
    [cashSessions]
  );

  const lastClosedSession = useMemo(() => {
    return cashSessions
      .filter((session) => !!session.closedAt)
      .sort(
        (a, b) =>
          new Date(b.closedAt ?? 0).getTime() - new Date(a.closedAt ?? 0).getTime()
      )[0] ?? null;
  }, [cashSessions]);

  const loadCashSessions = useCallback(async () => {
    if (!branchId) {
      setCashSessions([]);
      return;
    }

    setCashLoading(true);
    setCashError(null);
    try {
      const sessions = await backendApi.cash.listSessions({ skip: 0, take: 100 }, branchId);
      setCashSessions(sessions.items);
    } catch (err: any) {
      setCashError(err?.message || "No se pudieron cargar sesiones de caja.");
    } finally {
      setCashLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (activeTab !== "cashDaily") return;
    loadCashSessions();
  }, [activeTab, loadCashSessions]);

  useEffect(() => {
    loadCashSessions();
  }, [loadCashSessions]);

  const getMovementText = (event: AuditEvent) => {
    const summary = extractMovementSummary(event);
    if (!summary) return null;

    const productLabel = summary.productId
      ? productNameById.get(summary.productId) ?? summary.productId
      : "-";

    return {
      producto: productLabel,
      tipo: summary.movementType ?? "-",
      cantidad: summary.quantity ?? "-",
      stock: summary.resultingStock ?? "-",
      sucursal: summary.branchId ?? "-",
    };
  };

  const exportAudit = (format: "csv" | "pdf") => {
    const rows = filteredEvents.map((event) => {
      const movement = getMovementText(event);
      return {
        fecha: new Date(event.timestamp).toLocaleString(),
        usuario: event.userName,
        accion: event.action,
        entidad: event.entityType,
        descripcion: event.description,
        producto: movement?.producto ?? "-",
        tipoMovimiento: movement?.tipo ?? "-",
        cantidad: movement?.cantidad ?? "-",
        stockResultante: movement?.stock ?? "-",
      };
    });

    const payload = {
      filename: "reporte-auditoria",
      title: "Reporte de Auditoria",
      subtitle: "Historial de eventos del sistema con detalle de movimientos.",
      columns: [
        { key: "fecha", label: "Fecha" },
        { key: "usuario", label: "Usuario" },
        { key: "accion", label: "Accion" },
        { key: "entidad", label: "Entidad" },
        { key: "descripcion", label: "Descripcion" },
        { key: "producto", label: "Producto" },
        { key: "tipoMovimiento", label: "Tipo Movimiento" },
        { key: "cantidad", label: "Cantidad" },
        { key: "stockResultante", label: "Stock Resultante" },
      ],
      rows,
    };

    if (format === "csv") {
      exportRowsToCsv(payload);
      return;
    }
    exportRowsToPdf(payload);
  };

  const exportCashiers = (format: "csv" | "pdf") => {
    const payload = {
      filename: "reporte-cajeros",
      title: "Reporte de Cajeros",
      subtitle: "Desempeno de cajeros segun ventas registradas.",
      columns: [
        { key: "cajero", label: "Cajero" },
        { key: "totalVendido", label: "Total Vendido" },
        { key: "operaciones", label: "Operaciones" },
        { key: "ticketPromedio", label: "Ticket Promedio" },
      ],
      rows: cashierRows,
    };

    if (format === "csv") {
      exportRowsToCsv(payload);
      return;
    }
    exportRowsToPdf(payload);
  };

  const exportCashDaily = (format: "csv" | "pdf") => {
    const payload = {
      filename: "reporte-caja-diaria",
      title: "Reporte de Caja Diaria",
      subtitle: "Aperturas y cierres de caja por dia.",
      columns: [
        { key: "fecha", label: "Fecha" },
        { key: "apertura", label: "Apertura" },
        { key: "cierre", label: "Cierre" },
        { key: "fondoInicial", label: "Fondo Inicial" },
        { key: "esperado", label: "Esperado" },
        { key: "contado", label: "Contado" },
        { key: "diferencia", label: "Diferencia" },
        { key: "estado", label: "Estado" },
      ],
      rows: cashDailyRows,
    };

    if (format === "csv") {
      exportRowsToCsv(payload);
      return;
    }
    exportRowsToPdf(payload);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="w-fit bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Reportes de Auditoria
        </h1>
        <p className="text-muted-foreground">
          Visualiza actividad del sistema, detalle de movimientos y sesiones de caja.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted p-1 sm:w-auto sm:grid-cols-none sm:flex sm:flex-row">
          <TabsTrigger value="audit" className="rounded-lg px-4 py-2">
            <History className="mr-2 h-4 w-4" />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="cashiers" className="rounded-lg px-4 py-2">
            <Users className="mr-2 h-4 w-4" />
            Cajeros
          </TabsTrigger>
          <TabsTrigger value="cashDaily" className="rounded-lg px-4 py-2">
            <CalendarDays className="mr-2 h-4 w-4" />
            Caja diaria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          <Card className="border-none bg-card shadow-xl">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Historial de eventos
                  </CardTitle>
                  <CardDescription>
                    Registro detallado de acciones realizadas en el sistema.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportAudit("csv")}>
                    <Download className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportAudit("pdf")}>
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
              <div className="max-w-xs">
                <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por tipo de evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los eventos</SelectItem>
                    {eventTypes.map((eventType) => (
                      <SelectItem key={eventType} value={eventType}>
                        {eventType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {isLoading && (
                    <div className="py-10 text-center text-muted-foreground">
                      Cargando auditoria...
                    </div>
                  )}

                  {!isLoading && error && (
                    <div className="py-10 text-center text-destructive">{error}</div>
                  )}

                  {!isLoading && !error && filteredEvents.length === 0 && (
                    <div className="py-10 text-center text-muted-foreground">
                      No hay eventos para el filtro seleccionado.
                    </div>
                  )}

                  {!isLoading &&
                    !error &&
                    filteredEvents.map((event) => {
                      const movement = getMovementText(event);

                      return (
                        <div
                          key={event.id}
                          className="rounded-lg border bg-muted/30 p-4 transition-all hover:bg-muted/50"
                        >
                          <div className="flex items-start gap-4">
                            <div className="mt-1 rounded-full border bg-background p-2 shadow-sm">
                              {auditIcons[event.action] || <History className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">{event.description}</span>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {new Date(event.timestamp).toLocaleTimeString()}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <UserIcon className="h-3 w-3" />
                                <span className="font-medium text-foreground">{event.userName}</span>
                                <span>-</span>
                                <Badge variant="secondary" className="h-4 px-1 text-[9px] uppercase">
                                  {event.entityType}
                                </Badge>
                                <span>-</span>
                                <span>{new Date(event.timestamp).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          {movement && (
                            <div className="mt-3 grid gap-1 rounded-md border bg-background/80 p-2 text-xs">
                              <div>
                                <span className="font-semibold">Producto:</span> {movement.producto}
                              </div>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <span>
                                  <span className="font-semibold">Tipo:</span> {movement.tipo}
                                </span>
                                <span>
                                  <span className="font-semibold">Cantidad:</span> {movement.cantidad}
                                </span>
                                <span>
                                  <span className="font-semibold">Stock:</span> {movement.stock}
                                </span>
                                <span>
                                  <span className="font-semibold">Sucursal:</span> {movement.sucursal}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashiers" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCashiers("csv")}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCashiers("pdf")}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(salesByCashier).map(([name, data]) => (
              <Card key={name} className="overflow-hidden border-t-4 border-t-primary shadow-lg">
                <CardHeader className="pb-2">
                  <Badge variant="outline" className="mb-2 w-fit">
                    Usuario activo
                  </Badge>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                    {name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mt-2 space-y-4">
                    <div className="flex items-center justify-between border-b border-dashed py-2">
                      <span className="text-sm font-medium text-muted-foreground">Total vendido</span>
                      <span className="text-xl font-black text-primary">
                        ${data.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-dashed py-2">
                      <span className="text-sm font-medium text-muted-foreground">Operaciones</span>
                      <span className="font-bold">{data.count} ventas</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium text-muted-foreground">Ticket promedio</span>
                      <span className="font-bold">${(data.total / data.count).toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {Object.keys(salesByCashier).length === 0 && (
            <Card>
              <CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">
                No se registran ventas para el tipo de negocio actual.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cashDaily" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    Aperturas y cierres diarios de caja
                  </CardTitle>
                  <CardDescription>
                    Historial de sesiones de caja con montos esperados y diferencias.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadCashSessions}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Actualizar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportCashDaily("csv")}>
                    <Download className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportCashDaily("pdf")}>
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {cashLoading && (
                <div className="py-6 text-sm text-muted-foreground">Cargando sesiones de caja...</div>
              )}

              {!cashLoading && cashError && (
                <div className="py-6 text-sm text-destructive">{cashError}</div>
              )}

              {!cashLoading && !cashError && cashDailyRows.length === 0 && (
                <div className="py-6 text-sm text-muted-foreground">No hay sesiones de caja registradas.</div>
              )}

              {!cashLoading && !cashError && cashDailyRows.length > 0 && (
                <div className="space-y-3">
                  {lastClosedSession && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs">
                      <div className="font-semibold text-emerald-800">Ultimo cierre registrado</div>
                      <div className="mt-1 grid gap-1 sm:grid-cols-4">
                        <span>
                          <span className="font-semibold">Cierre:</span>{" "}
                          {new Date(lastClosedSession.closedAt ?? "").toLocaleString()}
                        </span>
                        <span>
                          <span className="font-semibold">Esperado:</span>{" "}
                          {Number(lastClosedSession.expectedCash ?? 0).toLocaleString("es-AR", {
                            style: "currency",
                            currency: "ARS",
                          })}
                        </span>
                        <span>
                          <span className="font-semibold">Contado:</span>{" "}
                          {Number(lastClosedSession.countedCash ?? 0).toLocaleString("es-AR", {
                            style: "currency",
                            currency: "ARS",
                          })}
                        </span>
                        <span>
                          <span className="font-semibold">Diferencia:</span>{" "}
                          {Number(lastClosedSession.difference ?? 0).toLocaleString("es-AR", {
                            style: "currency",
                            currency: "ARS",
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {cashDailyRows.map((row, index) => (
                      <div
                        key={`${row.fecha}-${row.apertura}-${index}`}
                        className="grid gap-2 rounded-md border p-3 text-xs sm:grid-cols-8"
                      >
                        <div>
                          <span className="font-semibold">Fecha:</span> {row.fecha}
                        </div>
                        <div>
                          <span className="font-semibold">Apertura:</span> {row.apertura}
                        </div>
                        <div>
                          <span className="font-semibold">Cierre:</span> {row.cierre}
                        </div>
                        <div>
                          <span className="font-semibold">Inicial:</span> {row.fondoInicial}
                        </div>
                        <div>
                          <span className="font-semibold">Esperado:</span> {row.esperado}
                        </div>
                        <div>
                          <span className="font-semibold">Contado:</span> {row.contado}
                        </div>
                        <div>
                          <span className="font-semibold">Diferencia:</span> {row.diferencia}
                        </div>
                        <div>
                          <span className="font-semibold">Estado:</span> {row.estado}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
