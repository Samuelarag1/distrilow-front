"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/components/providers/user-provider";
import { useBranches } from "@/components/providers/branch-provider";
import { useAudit } from "@/components/providers/audit-provider";
import { backendApi } from "@/lib/backend-api";
import type { CashMovementType, CashSession } from "@/lib/api-types";

const SESSION_POLL_INTERVAL_MS = 8_000;
const SESSION_HISTORY_DAYS = 60;
const AUTO_WITHDRAWAL_REASON = "Extraccion de turno para cierre";

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sin actividad";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin actividad";
  return parsed.toLocaleString("es-AR");
}

function toYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function CashModule() {
  const { currentUser, branchId } = useUser();
  const { branches } = useBranches();
  const { logEvent } = useAudit();
  const { toast } = useToast();

  const canManageCash =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    currentUser?.role === "cashier" ||
    currentUser?.role === "seller";

  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [lastClosedSession, setLastClosedSession] =
    useState<CashSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [openingFloat, setOpeningFloat] = useState("");
  const [movementType, setMovementType] = useState<CashMovementType>("IN");
  const [movementReason, setMovementReason] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [amountToLeave, setAmountToLeave] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  const currentSessionValidatorsRef = useRef<{
    etag: string | null;
  }>({
    etag: null,
  });

  const activeBranchName = useMemo(
    () =>
      branches.find((branch) => branch.id === branchId)?.name ?? "Sin sucursal",
    [branches, branchId]
  );

  const loadCurrentCashSession = useCallback(
    async (options?: { silent?: boolean; syncAmountToLeave?: boolean }) => {
      if (!canManageCash || !branchId) {
        currentSessionValidatorsRef.current = {
          etag: null,
        };
        setCashSession(null);
        if (options?.syncAmountToLeave) {
          setAmountToLeave("");
        }
        return;
      }

      const silent = options?.silent ?? false;

      try {
        if (!silent) {
          setIsLoading(true);
        }

        const response = await backendApi.cash.getCurrentSessionSnapshot({
          etag: currentSessionValidatorsRef.current.etag,
          branchIdOverride: branchId,
        });

        if (response.etag) {
          currentSessionValidatorsRef.current = {
            etag: response.etag ?? currentSessionValidatorsRef.current.etag,
          };
        }

        if (response.status === 304) {
          return;
        }

        setCashSession(response.session);

        if (options?.syncAmountToLeave) {
          const nextExpected = response.session?.expectedCash;
          if (nextExpected === undefined || nextExpected === null) {
            setAmountToLeave("");
          }
        }
      } catch (error: any) {
        if (!silent) {
          setCashSession(null);
          toast({
            variant: "destructive",
            title: "Error de caja",
            description:
              error?.message || "No se pudo obtener el estado actual de caja.",
          });
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [canManageCash, branchId, toast]
  );

  const loadSessionHistory = useCallback(async () => {
    if (!canManageCash || !branchId) {
      setLastClosedSession(null);
      return;
    }

    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - SESSION_HISTORY_DAYS);

      const sessions = await backendApi.cash.listSessions(
        {
          from: toYmd(from),
          to: toYmd(to),
          page: 1,
          limit: 100,
        },
        branchId
      );

      const latestClosed =
        sessions.items
          .filter(
            (session) => session.status === "CLOSED" && !!session.closedAt
          )
          .sort(
            (a, b) =>
              new Date(b.closedAt ?? 0).getTime() -
              new Date(a.closedAt ?? 0).getTime()
          )[0] ?? null;

      setLastClosedSession(latestClosed);
    } catch {
      setLastClosedSession(null);
    }
  }, [canManageCash, branchId]);

  useEffect(() => {
    currentSessionValidatorsRef.current = { etag: null };
    void Promise.all([
      loadCurrentCashSession({ syncAmountToLeave: true }),
      loadSessionHistory(),
    ]);
  }, [loadCurrentCashSession, loadSessionHistory, branchId]);

  useEffect(() => {
    if (!canManageCash || !branchId) return;
    const intervalId = window.setInterval(() => {
      void loadCurrentCashSession({ silent: true });
    }, SESSION_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [canManageCash, branchId, loadCurrentCashSession]);

  const refreshCashState = useCallback(
    async (options?: { syncAmountToLeave?: boolean }) => {
      await Promise.all([
        loadCurrentCashSession({
          silent: true,
          syncAmountToLeave: options?.syncAmountToLeave ?? false,
        }),
        loadSessionHistory(),
      ]);
    },
    [loadCurrentCashSession, loadSessionHistory]
  );

  const handleOpenCash = async () => {
    const opening = Number(openingFloat);
    if (!Number.isFinite(opening)) {
      toast({
        variant: "destructive",
        title: "Monto invalido",
        description: "Ingresa un fondo inicial numerico valido.",
      });
      return;
    }
    if (opening < 0) {
      toast({
        variant: "destructive",
        title: "Monto invalido",
        description: "No se puede abrir caja con un monto negativo.",
      });
      return;
    }

    try {
      setIsSaving(true);
      const session = await backendApi.cash.openSession({
        openingFloat: opening,
      });

      setCashSession(session);
      setOpeningFloat("");

      await refreshCashState({ syncAmountToLeave: true });

      toast({
        title: "Caja abierta",
        description: "Sesion abierta correctamente.",
      });
    } catch (error: any) {
      const message = String(error?.message ?? "");
      if (message.toLowerCase().includes("already an open cash session")) {
        await loadCurrentCashSession({ silent: true, syncAmountToLeave: true });
      }
      toast({
        variant: "destructive",
        title: "Error al abrir caja",
        description: message
          .toLowerCase()
          .includes("already an open cash session")
          ? "Ya existe una sesion de caja abierta para esta sucursal."
          : error?.message || "No se pudo abrir caja.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMovement = async () => {
    if (!cashSession) return;

    const amount = Number(movementAmount);
    const reason = movementReason.trim();
    if (!Number.isFinite(amount) || amount < 0.01) {
      toast({
        variant: "destructive",
        title: "Monto invalido",
        description: "El movimiento debe ser mayor a 0.",
      });
      return;
    }
    if (!reason) {
      toast({
        variant: "destructive",
        title: "Motivo requerido",
        description: "Ingresa un motivo para registrar el movimiento.",
      });
      return;
    }

    try {
      setIsSaving(true);
      const updated = await backendApi.cash.addMovement(cashSession.id, {
        type: movementType,
        reason,
        amount,
      });

      setCashSession(updated);
      setMovementAmount("");
      setMovementReason("");

      await refreshCashState();

      toast({
        title:
          movementType === "OUT"
            ? "Retiro de caja registrado"
            : "Movimiento registrado",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error en movimiento",
        description: error?.message || "No se pudo registrar movimiento.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const expectedCash = Number(cashSession?.expectedCash ?? 0);
  const amountToLeaveNumber = Number(amountToLeave);
  const hasValidAmountToLeave =
    Number.isFinite(amountToLeaveNumber) && amountToLeaveNumber >= 0;
  const suggestedWithdrawal = hasValidAmountToLeave
    ? Number((expectedCash - amountToLeaveNumber).toFixed(2))
    : expectedCash;

  const validateCloseCashInput = () => {
    if (!cashSession) return false;

    if (!hasValidAmountToLeave) {
      toast({
        variant: "destructive",
        title: "Monto invalido",
        description: "Ingresa un monto a dejar numerico valido.",
      });
      return;
    }

    if (suggestedWithdrawal < 0) {
      toast({
        variant: "destructive",
        title: "Monto no permitido",
        description:
          "El monto a dejar no puede ser mayor al efectivo esperado del turno.",
      });
      return false;
    }

    return true;
  };

  const confirmCloseCash = async () => {
    if (!cashSession) return;

    try {
      setIsSaving(true);

      if (suggestedWithdrawal > 0) {
        await backendApi.cash.addMovement(cashSession.id, {
          type: "OUT",
          reason: AUTO_WITHDRAWAL_REASON,
          amount: suggestedWithdrawal,
        });
      }

      const closedSession = await backendApi.cash.closeSession(cashSession.id, {
        countedCash: amountToLeaveNumber,
        notes: closeNotes.trim() || undefined,
      });

      const expectedAfterClose = Number(
        closedSession.expectedCash ?? amountToLeaveNumber
      );
      const difference = Number(
        closedSession.difference ?? amountToLeaveNumber - expectedAfterClose
      );

      logEvent(
        "close_cashbox",
        "cash_session",
        `Cierre de caja en ${activeBranchName}`,
        closedSession.id,
        {
          branchId: closedSession.branchId ?? branchId ?? null,
          countedCash: amountToLeaveNumber,
          expectedCash: expectedAfterClose,
          difference,
          withdrawalOut: suggestedWithdrawal > 0 ? suggestedWithdrawal : 0,
          amountForNextShift: amountToLeaveNumber,
          notes: closeNotes.trim() || null,
        }
      );

      setCloseNotes("");

      await refreshCashState({
        syncAmountToLeave: true,
      });

      toast({
        title: "Caja cerrada",
        description: "Turno cerrado correctamente.",
      });
      setIsCloseConfirmOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al cerrar caja",
        description: error?.message || "No se pudo cerrar caja.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseCash = () => {
    if (!validateCloseCashInput()) return;
    setIsCloseConfirmOpen(true);
  };

  const withdrawalMovements = useMemo(
    () =>
      (cashSession?.movements ?? [])
        .filter((movement) => movement.type === "OUT")
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
        ),
    [cashSession?.movements]
  );

  const withdrawalTotal = useMemo(
    () =>
      withdrawalMovements.reduce(
        (total, movement) => total + Number(movement.amount ?? 0),
        0
      ),
    [withdrawalMovements]
  );

  const displayedCountedCash =
    cashSession?.countedCash ??
    (hasValidAmountToLeave ? Number(amountToLeaveNumber) : null);
  const displayedDifference =
    cashSession?.difference ??
    (hasValidAmountToLeave
      ? Number((amountToLeaveNumber - expectedCash).toFixed(2))
      : null);

  if (!canManageCash) {
    return (
      <Card>
        <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-semibold">Acceso denegado</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Solo administradores, managers, cajeros y sellers pueden gestionar
            caja.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Gestion de Caja por Turno
        </h1>
        <p className="text-sm text-muted-foreground">
          Apertura, movimientos de caja y cierre con extraccion de turno.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Estado de Caja
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={cashSession ? "default" : "secondary"}>
                {cashSession ? "Caja abierta" : "Caja cerrada"}
              </Badge>
              <Badge variant="outline">
                Ultima actividad: {formatDateTime(cashSession?.lastActivityAt)}
              </Badge>
            </div>
          </div>

          <div className="grid gap-2 sm:max-w-sm">
            <Label>Sucursal activa (sesion)</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
              {activeBranchName}
            </div>
            <p className="text-xs text-muted-foreground">
              La caja opera con la sucursal actual de tu sesion.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading && (
            <div className="text-sm text-muted-foreground">
              Cargando estado de caja...
            </div>
          )}

          {!cashSession ? (
            <div className="max-w-sm space-y-2">
              <Label htmlFor="opening-float">Fondo inicial</Label>
              <Input
                id="opening-float"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={openingFloat}
                onChange={(event) => setOpeningFloat(event.target.value)}
              />
              <Button
                className="w-full"
                onClick={handleOpenCash}
                disabled={isSaving || !branchId}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Abrir Caja
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-md border p-4">
                <h3 className="text-sm font-semibold">Sesion actual</h3>
                <p className="text-sm">
                  Apertura:{" "}
                  <strong>{formatDateTime(cashSession.openedAt)}</strong>
                </p>
                <p className="text-sm">
                  Fondo inicial:{" "}
                  <strong>{formatMoney(cashSession.openingFloat)}</strong>
                </p>
                <p className="text-sm">
                  Efectivo esperado:{" "}
                  <strong>{formatMoney(expectedCash)}</strong>
                </p>
              </div>

              <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Pagos efectivo
                  </p>
                  <p className="text-base font-semibold">
                    {formatMoney(cashSession.totals?.cashPayments ?? 0)}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Pagos transferencia
                  </p>
                  <p className="text-base font-semibold">
                    {formatMoney(cashSession.totals?.transferPayments ?? 0)}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Ingresos manuales
                  </p>
                  <p className="text-base font-semibold">
                    {formatMoney(cashSession.totals?.movementIn ?? 0)}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Retiros de caja
                  </p>
                  <p className="text-base font-semibold">
                    {formatMoney(cashSession.totals?.movementOut ?? 0)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-md border p-4">
                <h3 className="text-sm font-semibold">Registrar movimiento</h3>
                <Select
                  value={movementType}
                  onValueChange={(value) =>
                    setMovementType(value as CashMovementType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Ingreso manual</SelectItem>
                    <SelectItem value="OUT">Retiro de caja</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Monto"
                  value={movementAmount}
                  onChange={(event) => setMovementAmount(event.target.value)}
                />
                <Input
                  placeholder="Motivo"
                  value={movementReason}
                  onChange={(event) => setMovementReason(event.target.value)}
                  maxLength={120}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleAddMovement}
                  disabled={isSaving}
                >
                  Registrar Movimiento
                </Button>
              </div>

              <div className="space-y-2 rounded-md border p-4">
                <h3 className="text-sm font-semibold">Cerrar turno</h3>

                <Input
                  id="amount-to-leave"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amountToLeave}
                  onChange={(event) => setAmountToLeave(event.target.value)}
                />

                <Button className="w-full" onClick={handleCloseCash}>
                  {isSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Cerrar Caja
                </Button>
              </div>

              <div className="space-y-3 rounded-md border p-4 lg:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Retiros del turno</h3>
                  <Badge variant="outline">
                    Total: {formatMoney(withdrawalTotal)}
                  </Badge>
                </div>

                {withdrawalMovements.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay retiros de caja registrados en este turno.
                  </p>
                ) : (
                  <div className="max-h-52 space-y-2 overflow-auto pr-1">
                    {withdrawalMovements.map((movement) => (
                      <div
                        key={movement.id}
                        className="flex items-center justify-between rounded-md border p-2 text-xs"
                      >
                        <div>
                          <p className="font-medium">
                            {movement.reason || "Retiro de caja"}
                          </p>
                          <p className="text-muted-foreground">
                            {formatDateTime(movement.createdAt)}
                          </p>
                        </div>
                        <p className="font-semibold text-red-600">
                          -{formatMoney(movement.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={isCloseConfirmOpen}
        onOpenChange={(open) => {
          if (isSaving) return;
          setIsCloseConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cierre de caja</AlertDialogTitle>
            <AlertDialogDescription>
              Te llevas <strong>{formatMoney(suggestedWithdrawal)}</strong> en
              efectivo de la caja y te quedan{" "}
              <strong>{formatMoney(amountToLeaveNumber)}</strong> para el
              proximo turno. Estas seguro de confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmCloseCash();
              }}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar cierre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
