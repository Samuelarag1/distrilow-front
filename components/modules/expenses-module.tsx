"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Search,
  RefreshCcw,
  Receipt,
  ShieldCheck,
  TrendingUp,
  PieChart,
  Trash2,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { backendApi } from "@/lib/backend-api";
import type {
  Expense,
  SnapshotPeriod,
  ExpenseAnalyticsResponse,
} from "@/lib/api-types";
import {
  EXPENSE_CATEGORY_OPTIONS,
  getExpenseCategoryLabel,
} from "@/lib/expense-categories";
import { BrandMark } from "@/components/common/brand-mark";
import { BrandSpinner } from "@/components/common/brand-spinner";
import { useTransactions } from "@/components/providers/transactions-provider";
import { useUser } from "@/components/providers/user-provider";
import { subscribeExpensesSync } from "@/lib/expenses-live-sync";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 350;
const MAX_EXPENSE_AMOUNT = 9_999_999.99;
const MAX_EXPENSE_DESCRIPTION_LENGTH = 180;
const WINDOW_REFRESH_COOLDOWN_MS = 20_000;

type ExpenseSituation = {
  label: string;
  detail: string;
  badgeClassName: string;
};

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getExpenseSituation(
  amount: number,
  referenceAmount: number
): ExpenseSituation {
  const safeReference = referenceAmount > 0 ? referenceAmount : 1;
  const ratio = amount / safeReference;

  if (ratio >= 1.8) {
    return {
      label: "Critico",
      detail: "Impacto alto en el periodo",
      badgeClassName: "bg-red-100 text-red-800",
    };
  }
  if (ratio >= 1.1) {
    return {
      label: "Atencion",
      detail: "Por encima del promedio",
      badgeClassName: "bg-amber-100 text-amber-800",
    };
  }
  return {
    label: "Controlado",
    detail: "Dentro del rango esperado",
    badgeClassName: "bg-emerald-100 text-emerald-800",
  };
}

export function ExpensesModule() {
  const { addExpense } = useTransactions();
  const { branches, branchId } = useUser();
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [analyticsPeriod, setAnalyticsPeriod] =
    useState<SnapshotPeriod>("monthly");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [listMeta, setListMeta] = useState({
    total: 0,
    offset: 0,
    limit: PAGE_SIZE,
    hasMore: false,
  });
  const [analytics, setAnalytics] = useState<ExpenseAnalyticsResponse | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [detailTarget, setDetailTarget] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const listRequestIdRef = useRef(0);
  const analyticsRequestIdRef = useRef(0);
  const lastAutoRefreshAtRef = useRef(0);

  const [newExpense, setNewExpense] = useState({
    amount: "",
    category: "",
    description: "",
  });
  const allowedCategories = useMemo(
    () => new Set(EXPENSE_CATEGORY_OPTIONS.map((category) => category.value)),
    []
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const loadExpenses = useCallback(async () => {
    const requestId = ++listRequestIdRef.current;
    if (!branchId) {
      if (requestId !== listRequestIdRef.current) return;
      setIsLoadingList(false);
      setExpenses([]);
      setListMeta({
        total: 0,
        offset: 0,
        limit: PAGE_SIZE,
        hasMore: false,
      });
      setLastSyncedAt(null);
      return;
    }

    try {
      setIsLoadingList(true);
      const offset = (currentPage - 1) * PAGE_SIZE;
      const payload = await backendApi.expenses.list(
        {
          skip: offset,
          take: PAGE_SIZE,
          search: debouncedSearchQuery || undefined,
          category: categoryFilter === "all" ? undefined : categoryFilter,
        },
        branchId
      );

      if (requestId !== listRequestIdRef.current) return;

      setExpenses(payload.items);
      setListMeta({
        total: payload.meta.total,
        offset: payload.meta.offset,
        limit: payload.meta.limit,
        hasMore: payload.meta.hasMore,
      });
      setLastSyncedAt(new Date().toISOString());
    } catch (error: any) {
      if (requestId !== listRequestIdRef.current) return;
      toast({
        variant: "destructive",
        title: "No pudimos cargar los gastos",
        description: getUserFacingErrorMessage(
          error,
          "Intenta nuevamente en unos segundos."
        ),
      });
    } finally {
      if (requestId !== listRequestIdRef.current) return;
      setIsLoadingList(false);
    }
  }, [branchId, currentPage, debouncedSearchQuery, categoryFilter, toast]);

  const loadAnalytics = useCallback(async () => {
    const requestId = ++analyticsRequestIdRef.current;
    if (!branchId) {
      if (requestId !== analyticsRequestIdRef.current) return;
      setIsLoadingAnalytics(false);
      setAnalytics(null);
      return;
    }

    try {
      setIsLoadingAnalytics(true);
      const response = await backendApi.reporting.expenses.history(
        {
          period: analyticsPeriod,
        },
        branchId
      );

      if (requestId !== analyticsRequestIdRef.current) return;

      setAnalytics(response);
      setLastSyncedAt(new Date().toISOString());
    } catch (error: any) {
      if (requestId !== analyticsRequestIdRef.current) return;
      setAnalytics(null);
      toast({
        variant: "destructive",
        title: "No pudimos actualizar el resumen",
        description: getUserFacingErrorMessage(
          error,
          "No se pudieron cargar las metricas del periodo."
        ),
      });
    } finally {
      if (requestId !== analyticsRequestIdRef.current) return;
      setIsLoadingAnalytics(false);
    }
  }, [branchId, analyticsPeriod, toast]);

  const refreshAll = useCallback(
    async (origin: "manual" | "focus" | "mutation" = "manual") => {
      if (!branchId) return;
      if (origin === "mutation") {
        lastAutoRefreshAtRef.current = Date.now();
      }
      if (origin === "manual") setIsRefreshing(true);

      try {
        await Promise.all([loadExpenses(), loadAnalytics()]);
      } finally {
        if (origin === "manual") setIsRefreshing(false);
      }
    },
    [branchId, loadExpenses, loadAnalytics]
  );

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (!branchId) return;

    const refreshOnFocus = () => {
      const now = Date.now();
      if (now - lastAutoRefreshAtRef.current < WINDOW_REFRESH_COOLDOWN_MS)
        return;
      lastAutoRefreshAtRef.current = now;
      void refreshAll("focus");
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      refreshOnFocus();
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [branchId, refreshAll]);

  useEffect(() => {
    if (!branchId) return;

    return subscribeExpensesSync((payload) => {
      if (payload.branchId && payload.branchId !== branchId) return;

      const now = Date.now();
      if (now - lastAutoRefreshAtRef.current < WINDOW_REFRESH_COOLDOWN_MS)
        return;
      lastAutoRefreshAtRef.current = now;
      void refreshAll("mutation");
    });
  }, [branchId, refreshAll]);

  const totalPages = Math.max(
    1,
    Math.ceil(listMeta.total / Math.max(listMeta.limit, 1))
  );

  const topCategories = useMemo(() => {
    const rows = analytics?.byCategory ?? [];
    return rows.slice(0, 4);
  }, [analytics]);

  const topCategory = useMemo(() => topCategories[0] ?? null, [topCategories]);

  const averageVisibleExpense = useMemo(() => {
    if (expenses.length === 0) return 0;
    return (
      expenses.reduce(
        (sum, expense) => sum + toFiniteNumber(expense.amount, 0),
        0
      ) / expenses.length
    );
  }, [expenses]);

  const evolutionSummary = useMemo(() => {
    const points = analytics?.evolution ?? [];
    if (points.length < 2) {
      return {
        trend: "STABLE" as const,
        deltaPercent: 0,
      };
    }

    const current = toFiniteNumber(points[points.length - 1]?.total, 0);
    const previous = toFiniteNumber(points[points.length - 2]?.total, 0);
    const deltaPercent =
      previous === 0
        ? current > 0
          ? 100
          : 0
        : ((current - previous) / previous) * 100;

    if (deltaPercent > 5) return { trend: "UP" as const, deltaPercent };
    if (deltaPercent < -5) return { trend: "DOWN" as const, deltaPercent };
    return { trend: "STABLE" as const, deltaPercent };
  }, [analytics]);

  const maxEvolutionTotal = useMemo(() => {
    const values = (analytics?.evolution ?? []).map((entry) =>
      toFiniteNumber(entry.total, 0)
    );
    return Math.max(...values, 1);
  }, [analytics]);

  const detailSituation = useMemo(() => {
    if (!detailTarget) return null;
    return getExpenseSituation(
      toFiniteNumber(detailTarget.amount, 0),
      averageVisibleExpense
    );
  }, [detailTarget, averageVisibleExpense]);

  const handleAddExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmittingExpense) return;

    const amount = Number(newExpense.amount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > MAX_EXPENSE_AMOUNT
    ) {
      toast({
        variant: "destructive",
        title: "Monto invalido",
        description: `Ingresa un monto entre 0.01 y ${MAX_EXPENSE_AMOUNT}.`,
      });
      return;
    }

    if (!allowedCategories.has(newExpense.category)) {
      toast({
        variant: "destructive",
        title: "Categoria invalida",
        description: "Selecciona una categoria valida.",
      });
      return;
    }

    const normalizedDescription = newExpense.description.trim();
    if (!normalizedDescription) {
      toast({
        variant: "destructive",
        title: "Descripcion requerida",
        description: "Completa la descripcion del gasto.",
      });
      return;
    }
    if (normalizedDescription.length > MAX_EXPENSE_DESCRIPTION_LENGTH) {
      toast({
        variant: "destructive",
        title: "Descripcion muy larga",
        description: `Usa hasta ${MAX_EXPENSE_DESCRIPTION_LENGTH} caracteres.`,
      });
      return;
    }

    try {
      setIsSubmittingExpense(true);
      await addExpense({
        amount,
        category: newExpense.category as any,
        description: normalizedDescription,
      });
      toast({
        title: "Gasto registrado",
        description: "El gasto quedo guardado correctamente.",
      });
      setNewExpense({
        amount: "",
        category: "",
        description: "",
      });
      setIsDialogOpen(false);
      setCurrentPage(1);
      await refreshAll("mutation");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No pudimos guardar el gasto",
        description: getUserFacingErrorMessage(
          error,
          "Revisa los datos ingresados e intenta nuevamente."
        ),
      });
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await backendApi.expenses.remove(deleteTarget.id);
      toast({
        title: "Gasto eliminado",
        description: "El registro se elimino correctamente.",
      });
      setDeleteTarget(null);
      await refreshAll("mutation");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No pudimos eliminar el gasto",
        description: getUserFacingErrorMessage(
          error,
          "Intenta nuevamente en unos segundos."
        ),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8 rounded-lg" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Gastos
            </h1>
          </div>
          <p className="text-muted-foreground">
            Panel operativo con desglose por situacion y categoria.
          </p>
          <p className="text-xs text-muted-foreground">
            Ultima sincronizacion:{" "}
            {lastSyncedAt
              ? format(new Date(lastSyncedAt), "dd/MM/yyyy HH:mm:ss")
              : "Sin datos"}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Gasto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[470px]">
              <form onSubmit={handleAddExpense}>
                <DialogHeader>
                  <DialogTitle>Registrar Gasto</DialogTitle>
                  <DialogDescription>
                    El gasto se registrara en la sucursal activa.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Monto</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={newExpense.amount}
                      onChange={(event) =>
                        setNewExpense((prev) => ({
                          ...prev,
                          amount: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Categoria</Label>
                    <select
                      value={newExpense.category}
                      onChange={(event) =>
                        setNewExpense((prev) => ({
                          ...prev,
                          category: event.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      required
                    >
                      <option value="">Selecciona una categoria</option>
                      {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Descripcion</Label>
                    <Input
                      id="description"
                      maxLength={MAX_EXPENSE_DESCRIPTION_LENGTH}
                      value={newExpense.description}
                      onChange={(event) =>
                        setNewExpense((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sucursal activa:{" "}
                    {branches.find((branch) => branch.id === branchId)?.name ??
                      "Sin sucursal"}
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmittingExpense}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmittingExpense}>
                    {isSubmittingExpense ? "Guardando..." : "Guardar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total periodo</CardTitle>
            <Receipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingAnalytics ? (
              <BrandSpinner size="sm" label="Cargando..." layout="inline" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatMoney(analytics?.total ?? 0)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {analyticsPeriod}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Categorias activas
            </CardTitle>
            <PieChart className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.byCategory?.length ?? 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Top actual:{" "}
              {topCategory
                ? getExpenseCategoryLabel(topCategory.category)
                : "Sin categoria dominante"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>Listado de gastos</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={analyticsPeriod}
                onChange={(event) =>
                  setAnalyticsPeriod(event.target.value as SnapshotPeriod)
                }
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="semiannual">Semestral</option>
                <option value="annual">Anual</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">Todas las categorias</option>
                {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar gastos..."
                className="pl-8"
                value={searchInput}
                maxLength={120}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {searchInput.trim() !== debouncedSearchQuery && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCcw className="h-3 w-3 animate-spin" />
                Aplicando filtros...
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Situacion</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingList ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <BrandSpinner
                        size="sm"
                        label="Cargando gastos..."
                        layout="inline"
                      />
                    </TableCell>
                  </TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No hay gastos para los filtros actuales.
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => {
                    const situation = getExpenseSituation(
                      toFiniteNumber(expense.amount, 0),
                      averageVisibleExpense
                    );

                    return (
                      <TableRow key={expense.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(
                            new Date(
                              expense.createdAt ??
                                expense.updatedAt ??
                                new Date()
                            ),
                            "dd/MM/yyyy HH:mm",
                            {
                              locale: es,
                            }
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[260px]">
                            <p className="truncate font-medium">
                              {expense.description}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {expense.id}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {getExpenseCategoryLabel(expense.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={situation.badgeClassName}>
                              {situation.label}
                            </Badge>
                            <p className="text-[11px] text-muted-foreground">
                              {situation.detail}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMoney(expense.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailTarget(expense)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(expense)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoadingList && listMeta.total > 0 && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {listMeta.offset + 1}-
                {Math.min(listMeta.offset + listMeta.limit, listMeta.total)} de{" "}
                {listMeta.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage <= 1}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Pagina {currentPage} de {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={!listMeta.hasMore}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {topCategory?.sharePercent !== undefined &&
            topCategory.sharePercent > 60 && (
              <div className="mt-2 flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Alta concentracion en{" "}
                {getExpenseCategoryLabel(topCategory.category)} (
                {topCategory.sharePercent.toFixed(1)}%).
              </div>
            )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(detailTarget)}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle de gasto</DialogTitle>
            <DialogDescription>ID: {detailTarget?.id}</DialogDescription>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground">Monto</p>
                  <p className="font-semibold">
                    {formatMoney(detailTarget.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Categoria</p>
                  <p className="font-semibold">
                    {getExpenseCategoryLabel(detailTarget.category)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Situacion</p>
                  {detailSituation && (
                    <Badge className={detailSituation.badgeClassName}>
                      {detailSituation.label}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <p className="font-semibold">Descripcion</p>
                <p className="mt-1 text-muted-foreground">
                  {detailTarget.description}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailTarget(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar gasto</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion elimina el gasto seleccionado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteExpense}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
