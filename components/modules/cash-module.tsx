"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, Loader2, ShieldAlert } from "lucide-react";
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
import { useTransactions } from "@/components/providers/transactions-provider";
import { useAudit } from "@/components/providers/audit-provider";
import { backendApi } from "@/lib/backend-api";
import type {
  CashBookDailyResponse,
  CashMovementType,
  CashSession,
} from "@/lib/api-types";

export function CashModule() {
  const { currentUser, branchId } = useUser();
  const { branches } = useBranches();
  const { addExpense } = useTransactions();
  const { logEvent } = useAudit();
  const { toast } = useToast();

  const canManageCash =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    currentUser?.role === "cashier" ||
    currentUser?.role === "seller";

  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [openingFloat, setOpeningFloat] = useState("");
  const [movementType, setMovementType] = useState<CashMovementType>("IN");
  const [movementReason, setMovementReason] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [dailyBookDate, setDailyBookDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dailyBookPage, setDailyBookPage] = useState(1);
  const dailyBookPageSize = 20;
  const [dailyBook, setDailyBook] = useState<CashBookDailyResponse | null>(
    null
  );
  const [isLoadingDailyBook, setIsLoadingDailyBook] = useState(false);

  const activeBranchName = useMemo(
    () =>
      branches.find((branch) => branch.id === branchId)?.name ?? "Sin sucursal",
    [branches, branchId]
  );
  const allDailyEntries = useMemo(
    () => dailyBook?.entries.items ?? [],
    [dailyBook?.entries.items]
  );
  const paginatedDailyEntries = useMemo(() => {
    const start = (dailyBookPage - 1) * dailyBookPageSize;
    return allDailyEntries.slice(start, start + dailyBookPageSize);
  }, [allDailyEntries, dailyBookPage, dailyBookPageSize]);
  const totalDailyPages = Math.max(
    1,
    Math.ceil(allDailyEntries.length / dailyBookPageSize)
  );

  const loadCurrentCashSession = useCallback(async () => {
    if (!canManageCash || !branchId) {
      setCashSession(null);
      return;
    }

    try {
      setIsLoading(true);
      const session = await backendApi.cash.getCurrentSession();
      setCashSession(session);
      if (
        session?.expectedCash !== undefined &&
        session?.expectedCash !== null
      ) {
        setCountedCash(String(session.expectedCash));
      }
    } catch (error: any) {
      setCashSession(null);
      toast({
        variant: "destructive",
        title: "Error de caja",
        description:
          error?.message || "No se pudo obtener el estado actual de caja.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [canManageCash, branchId, toast]);

  const loadDailyBook = useCallback(async () => {
    if (!canManageCash || !branchId) {
      setDailyBook(null);
      return;
    }

    try {
      setIsLoadingDailyBook(true);
      const response = await backendApi.cash.dailyBook(
        {
          date: dailyBookDate,
        },
        branchId
      );
      setDailyBook(response);
    } catch (error: any) {
      setDailyBook(null);
      toast({
        variant: "destructive",
        title: "Error en libro diario",
        description:
          error?.message || "No se pudo obtener el libro diario de caja.",
      });
    } finally {
      setIsLoadingDailyBook(false);
    }
  }, [canManageCash, branchId, dailyBookDate, toast]);

  useEffect(() => {
    loadCurrentCashSession();
  }, [loadCurrentCashSession]);

  useEffect(() => {
    void loadDailyBook();
  }, [loadDailyBook]);

  useEffect(() => {
    if (dailyBookPage > totalDailyPages) {
      setDailyBookPage(totalDailyPages);
    }
  }, [dailyBookPage, totalDailyPages]);

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
      setCountedCash(String(session.expectedCash ?? ""));
      void loadDailyBook();
      toast({
        title: "Caja abierta",
        description: "Sesion abierta correctamente.",
      });
    } catch (error: any) {
      const message = String(error?.message ?? "");
      if (message.toLowerCase().includes("already an open cash session")) {
        await loadCurrentCashSession();
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

      if (movementType === "OUT") {
        try {
          await addExpense({
            amount,
            category: "OTHER",
            description: `Egreso de caja: ${reason}`,
            branchId: cashSession.branchId ?? branchId ?? undefined,
          });
        } catch (expenseError: any) {
          toast({
            variant: "destructive",
            title: "Movimiento registrado sin gasto",
            description:
              expenseError?.message ||
              "El egreso de caja se registro, pero no pudo crearse el gasto asociado.",
          });
        }
      }

      setCashSession(updated);
      setMovementAmount("");
      setMovementReason("");
      void loadDailyBook();
      toast({ title: "Movimiento registrado" });
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

  const handleCloseCash = async () => {
    if (!cashSession) return;

    const counted = Number(countedCash);
    if (!Number.isFinite(counted)) {
      toast({
        variant: "destructive",
        title: "Monto invalido",
        description: "Ingresa un efectivo contado numerico valido.",
      });
      return;
    }
    if (counted < 0) {
      toast({
        variant: "destructive",
        title: "Cierre no permitido",
        description: "No se puede cerrar caja con un monto negativo.",
      });
      return;
    }

    try {
      setIsSaving(true);
      const closedSession = await backendApi.cash.closeSession(cashSession.id, {
        countedCash: counted,
        notes: closeNotes.trim() || undefined,
      });
      const expected = Number(
        closedSession.expectedCash ?? cashSession.expectedCash ?? 0
      );
      const difference = Number(closedSession.difference ?? counted - expected);

      logEvent(
        "close_cashbox",
        "cash_session",
        `Cierre de caja en ${activeBranchName}`,
        closedSession.id,
        {
          branchId: closedSession.branchId ?? branchId ?? null,
          countedCash: counted,
          expectedCash: expected,
          difference,
          notes: closeNotes.trim() || null,
        }
      );

      setCashSession(null);
      setCountedCash("");
      setCloseNotes("");
      void loadDailyBook();
      toast({
        title: "Caja cerrada",
        description: "Sesion cerrada correctamente.",
      });
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
          Gestion de Caja
        </h1>
        <p className="text-sm text-muted-foreground">
          Apertura, movimientos y cierre de caja en una seccion dedicada.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Estado de Caja
            </CardTitle>
            <Badge variant={cashSession ? "default" : "secondary"}>
              {cashSession ? "Caja abierta" : "Caja cerrada"}
            </Badge>
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
                <h3 className="text-sm font-semibold">Resumen</h3>
                <p className="text-sm">
                  Estado:{" "}
                  <strong>
                    {cashSession.status === "OPEN" ? "Abierta" : "Cerrada"}
                  </strong>
                </p>
                <p className="text-sm">
                  Fondo inicial:{" "}
                  <strong>
                    ${Number(cashSession.openingFloat ?? 0).toLocaleString()}
                  </strong>
                </p>
                <p className="text-sm">
                  Esperado:{" "}
                  <strong>
                    ${Number(cashSession.expectedCash ?? 0).toLocaleString()}
                  </strong>
                </p>
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
                    <SelectItem value="IN">Ingreso</SelectItem>
                    <SelectItem value="OUT">Egreso</SelectItem>
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

              <div className="space-y-2 rounded-md border p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold">Cerrar caja</h3>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Efectivo contado"
                  value={countedCash}
                  onChange={(event) => setCountedCash(event.target.value)}
                />
                <Input
                  placeholder="Notas (opcional)"
                  value={closeNotes}
                  onChange={(event) => setCloseNotes(event.target.value)}
                  maxLength={600}
                />
                <Button
                  className="w-full"
                  onClick={handleCloseCash}
                  disabled={isSaving}
                >
                  {isSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Cerrar Caja
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
