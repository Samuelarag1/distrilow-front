"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import {
  EXPENSE_CATEGORY_OPTIONS,
  getExpenseCategoryLabel,
} from "@/lib/expense-categories";
import {
  formatDecimalAmountInput,
  parseDecimalAmountInput,
} from "@/lib/numeric-input";
import type {
  CashMovementType,
  CashSession,
  ExpenseCategory,
  ExpenseContext,
} from "@/lib/api-types";

const SESSION_POLL_INTERVAL_MS = 30_000;
const SESSION_HISTORY_DAYS = 60;
const PURCHASE_WITH_CASH = "PURCHASE_WITH_CASH" as const;
type CashMovementMode = CashMovementType | typeof PURCHASE_WITH_CASH;
const EXPENSE_CONTEXT_OPTIONS: Array<{
  value: ExpenseContext;
  label: string;
}> = [
  { value: "GENERAL", label: "General" },
  { value: "RETAIL", label: "Retail" },
  { value: "WHOLESALE", label: "Wholesale" },
];

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
  const [movementType, setMovementType] = useState<CashMovementMode>("OUT");
  const [movementReason, setMovementReason] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [purchaseExpenseCategory, setPurchaseExpenseCategory] = useState<
    ExpenseCategory | ""
  >("");
  const [purchaseExpenseContext, setPurchaseExpenseContext] =
    useState<ExpenseContext>("GENERAL");
  const [countedCashInput, setCountedCashInput] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

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
          setCountedCashInput("");
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
            setCountedCashInput("");
          }
        }
      } catch (error: any) {
        if (!silent) {
          setCashSession(null);
          toast({
            variant: "destructive",
            title: "No pudimos actualizar el estado de caja",
            description: getUserFacingErrorMessage(
              error,
              "Intenta nuevamente en unos segundos."
            ),
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
    const opening = parseDecimalAmountInput(openingFloat);
    if (!openingFloat.trim()) {
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
        description: "La caja ya esta lista para registrar movimientos.",
      });
    } catch (error: any) {
      const message = String(error?.message ?? "");
      if (message.toLowerCase().includes("already an open cash session")) {
        await loadCurrentCashSession({ silent: true, syncAmountToLeave: true });
      }
      toast({
        variant: "destructive",
        title: "No pudimos abrir la caja",
        description: message
          .toLowerCase()
          .includes("already an open cash session")
          ? "Ya hay una caja abierta en esta sucursal."
          : getUserFacingErrorMessage(
              error,
              "Revisa el monto inicial e intenta nuevamente."
            ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMovement = async () => {
    if (!cashSession) return;

    const amount = parseDecimalAmountInput(movementAmount);
    const reason = movementReason.trim();
    if (!movementAmount.trim() || !Number.isFinite(amount) || amount < 0.01) {
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

    if (movementType === PURCHASE_WITH_CASH) {
      if (!branchId) {
        toast({
          variant: "destructive",
          title: "Sucursal requerida",
          description: "Selecciona una sucursal activa antes de registrar la compra.",
        });
        return;
      }

      if (!purchaseExpenseCategory) {
        toast({
          variant: "destructive",
          title: "Categoria requerida",
          description: "Selecciona la categoria del gasto para la compra con caja.",
        });
        return;
      }

      if (amount > expectedCash) {
        toast({
          variant: "destructive",
          title: "Saldo insuficiente",
          description:
            "La compra no puede superar el efectivo esperado disponible en caja.",
        });
        return;
      }

      let createdExpenseId: string | null = null;
      let expenseRolledBack = false;

      try {
        setIsSaving(true);

        const createdExpense = await backendApi.expenses.create({
          branchId,
          amount,
          category: purchaseExpenseCategory,
          description: reason,
          context: purchaseExpenseContext,
        });
        createdExpenseId = createdExpense.id;

        const updated = await backendApi.cash.addMovement(cashSession.id, {
          type: "OUT",
          reason: `Compra con caja - ${getExpenseCategoryLabel(
            purchaseExpenseCategory
          )}: ${reason}`,
          amount,
        });

        setCashSession(updated);
        setMovementAmount("");
        setMovementReason("");
        setPurchaseExpenseCategory("");
        setPurchaseExpenseContext("GENERAL");

        await refreshCashState();

        logEvent(
          "create",
          "cash_expense",
          `Compra con caja por ${formatMoney(amount)} en ${activeBranchName}`,
          createdExpense.id,
          {
            branchId,
            cashSessionId: cashSession.id,
            amount,
            category: purchaseExpenseCategory,
            context: purchaseExpenseContext,
            description: reason,
          }
        );

        toast({
          title: "Compra con caja registrada",
          description: "Descontamos el importe de caja y lo registramos tambien en gastos.",
        });
      } catch (error: any) {
        if (createdExpenseId) {
          try {
            await backendApi.expenses.remove(createdExpenseId);
            expenseRolledBack = true;
          } catch {
            expenseRolledBack = false;
          }
        }

        toast({
          variant: "destructive",
          title: "No pudimos registrar la compra con caja",
          description: expenseRolledBack
            ? getUserFacingErrorMessage(
                error,
                "No pudimos registrar la salida de caja. El gasto fue revertido automaticamente."
              )
            : createdExpenseId
            ? "La operacion quedo incompleta. Revisa si el gasto o la salida de caja necesitan correccion manual."
            : getUserFacingErrorMessage(
                error,
                "Revisa los datos e intenta nuevamente."
              ),
        });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    try {
      setIsSaving(true);
      const updated = await backendApi.cash.addMovement(cashSession.id, {
        type: movementType as CashMovementType,
        reason,
        amount,
      });

      setCashSession(updated);
      setMovementAmount("");
      setMovementReason("");
      setPurchaseExpenseCategory("");
      setPurchaseExpenseContext("GENERAL");

      await refreshCashState();

      toast({
        title:
          movementType === "OUT"
            ? "Retiro de caja registrado"
            : "Movimiento registrado",
        description:
          movementType === "OUT"
            ? "La salida de dinero quedo registrada correctamente."
            : "El ingreso a caja quedo registrado correctamente.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No pudimos registrar el movimiento",
        description: getUserFacingErrorMessage(
          error,
          "Revisa los datos del movimiento e intenta nuevamente."
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const expectedCash = Number(cashSession?.expectedCash ?? 0);
  const countedCashNumber = parseDecimalAmountInput(countedCashInput);
  const hasValidCountedCash =
    countedCashInput.trim().length > 0 &&
    Number.isFinite(countedCashNumber) &&
    countedCashNumber >= 0;
  const closeDifferencePreview = hasValidCountedCash
    ? Number((countedCashNumber - expectedCash).toFixed(2))
    : 0;

  const validateCloseCashInput = () => {
    if (!cashSession) return false;

    if (!hasValidCountedCash) {
      toast({
        variant: "destructive",
        title: "Monto invalido",
        description: "Ingresa el efectivo contado con un valor numerico valido.",
      });
      return false;
    }

    return true;
  };

  const confirmCloseCash = async () => {
    if (!cashSession) return;

    try {
      setIsSaving(true);

      const closedSession = await backendApi.cash.closeSession(cashSession.id, {
        countedCash: countedCashNumber,
        notes: closeNotes.trim() || undefined,
      });

      const expectedAfterClose = Number(
        closedSession.expectedCash ?? countedCashNumber
      );
      const difference = Number(
        closedSession.difference ?? countedCashNumber - expectedAfterClose
      );

      logEvent(
        "close_cashbox",
        "cash_session",
        `Cierre de caja en ${activeBranchName}`,
        closedSession.id,
        {
          branchId: closedSession.branchId ?? branchId ?? null,
          countedCash: countedCashNumber,
          expectedCash: expectedAfterClose,
          difference,
          notes: closeNotes.trim() || null,
        }
      );

      setCloseNotes("");

      await refreshCashState({
        syncAmountToLeave: true,
      });

      toast({
        title: "Caja cerrada",
        description: "El turno se cerro correctamente y la caja quedo actualizada.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No pudimos cerrar la caja",
        description: getUserFacingErrorMessage(
          error,
          "Revisa el monto contado e intenta nuevamente."
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseCash = async () => {
    if (!validateCloseCashInput()) return;
    await confirmCloseCash();
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
          Apertura, movimientos, compras con caja y cierre con arqueo real.
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
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={openingFloat}
                onChange={(event) =>
                  setOpeningFloat(formatDecimalAmountInput(event.target.value))
                }
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
                    Salidas de caja
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
                    setMovementType(value as CashMovementMode)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OUT">Retiro de caja</SelectItem>
                    <SelectItem value={PURCHASE_WITH_CASH}>
                      Compra con dinero en caja
                    </SelectItem>
                  </SelectContent>
                </Select>
                {movementType === PURCHASE_WITH_CASH && (
                  <>
                    <Select
                      value={purchaseExpenseCategory}
                      onValueChange={(value) =>
                        setPurchaseExpenseCategory(value as ExpenseCategory)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Categoria del gasto" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={purchaseExpenseContext}
                      onValueChange={(value) =>
                        setPurchaseExpenseContext(value as ExpenseContext)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Contexto del gasto" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CONTEXT_OPTIONS.map((contextOption) => (
                          <SelectItem
                            key={contextOption.value}
                            value={contextOption.value}
                          >
                            {contextOption.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Monto"
                  value={movementAmount}
                  onChange={(event) =>
                    setMovementAmount(
                      formatDecimalAmountInput(event.target.value)
                    )
                  }
                />
                <Input
                  placeholder={
                    movementType === PURCHASE_WITH_CASH
                      ? "Descripcion de la compra"
                      : "Motivo"
                  }
                  value={movementReason}
                  onChange={(event) => setMovementReason(event.target.value)}
                  maxLength={180}
                />
                {movementType === PURCHASE_WITH_CASH && (
                  <p className="text-xs text-muted-foreground">
                    Esta opcion registra un gasto y descuenta el importe del efectivo esperado en caja.
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleAddMovement}
                  disabled={isSaving}
                >
                  {movementType === PURCHASE_WITH_CASH
                    ? "Registrar compra con caja"
                    : "Registrar Movimiento"}
                </Button>
              </div>

              <div className="space-y-2 rounded-md border p-4">
                <h3 className="text-sm font-semibold">Cerrar turno</h3>

                <Label htmlFor="counted-cash">Efectivo contado al cierre</Label>
                <Input
                  id="counted-cash"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={countedCashInput}
                  onChange={(event) =>
                    setCountedCashInput(
                      formatDecimalAmountInput(event.target.value)
                    )
                  }
                />

                <p className="text-xs text-muted-foreground">
                  Puedes cerrar con menos o mas efectivo que el esperado. La
                  diferencia se registrara solo como arqueo, sin crear retiros
                  automaticos.
                </p>

                {hasValidCountedCash && (
                  <p className="text-xs text-muted-foreground">
                    {closeDifferencePreview > 0
                      ? `Estas cerrando con ${formatMoney(
                          closeDifferencePreview
                        )} por encima de lo esperado. Se registrara como diferencia positiva.`
                      : closeDifferencePreview < 0
                      ? `Estas cerrando con ${formatMoney(
                          Math.abs(closeDifferencePreview)
                        )} por debajo de lo esperado. Se registrara como diferencia negativa.`
                      : "El cierre coincide exactamente con el efectivo esperado."}
                  </p>
                )}

                <Button
                  className="w-full"
                  onClick={() => void handleCloseCash()}
                  disabled={isSaving}
                >
                  {isSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Cerrar Caja
                </Button>
              </div>

              <div className="space-y-3 rounded-md border p-4 lg:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Salidas del turno</h3>
                  <Badge variant="outline">
                    Total: {formatMoney(withdrawalTotal)}
                  </Badge>
                </div>

                {withdrawalMovements.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay salidas de caja registradas en este turno.
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

    </div>
  );
}
