"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Plus,
  Search,
  Receipt,
  TrendingUp,
  PieChart,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { backendApi } from "@/lib/backend-api";
import type {
  Expense,
  ExpenseContext,
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

const PAGE_SIZE = 15;

type ContextFilter = ExpenseContext | "ALL";

const CONTEXT_LABELS: Record<ContextFilter, string> = {
  ALL: "Todos",
  GENERAL: "General",
  RETAIL: "Minorista",
  WHOLESALE: "Mayorista",
};

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

export function ExpensesModule() {
  const { addExpense } = useTransactions();
  const { branches, branchId } = useUser();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [contextFilter, setContextFilter] = useState<ContextFilter>("ALL");
  const [analyticsPeriod, setAnalyticsPeriod] =
    useState<SnapshotPeriod>("monthly");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expenses, setExpenses] = useState<Expense[]>([]);
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
  const [isDeleting, setIsDeleting] = useState(false);

  const [newExpense, setNewExpense] = useState({
    amount: "",
    category: "",
    description: "",
    context: "GENERAL" as ExpenseContext,
  });

  const loadExpenses = useCallback(async () => {
    if (!branchId) {
      setExpenses([]);
      setListMeta({
        total: 0,
        offset: 0,
        limit: PAGE_SIZE,
        hasMore: false,
      });
      return;
    }

    try {
      setIsLoadingList(true);
      const offset = (currentPage - 1) * PAGE_SIZE;
      const payload = await backendApi.expenses.list(
        {
          skip: offset,
          take: PAGE_SIZE,
          search: searchQuery.trim() || undefined,
          category: categoryFilter === "all" ? undefined : categoryFilter,
          context: contextFilter === "ALL" ? undefined : contextFilter,
        },
        branchId
      );
      setExpenses(payload.items);
      setListMeta({
        total: payload.meta.total,
        offset: payload.meta.offset,
        limit: payload.meta.limit,
        hasMore: payload.meta.hasMore,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al cargar gastos",
        description: error?.message ?? "Intenta nuevamente.",
      });
    } finally {
      setIsLoadingList(false);
    }
  }, [
    branchId,
    currentPage,
    searchQuery,
    categoryFilter,
    contextFilter,
    toast,
  ]);

  const loadAnalytics = useCallback(async () => {
    if (!branchId) {
      setAnalytics(null);
      return;
    }

    try {
      setIsLoadingAnalytics(true);
      const response = await backendApi.expenses.analytics(
        {
          period: analyticsPeriod,
          context: contextFilter === "ALL" ? undefined : contextFilter,
        },
        branchId
      );
      setAnalytics(response);
    } catch (error: any) {
      setAnalytics(null);
      toast({
        variant: "destructive",
        title: "Error en analytics",
        description: error?.message ?? "No se pudieron cargar las metricas.",
      });
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [branchId, analyticsPeriod, contextFilter, toast]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const totalPages = Math.max(
    1,
    Math.ceil(listMeta.total / Math.max(listMeta.limit, 1))
  );

  const topCategories = useMemo(() => {
    const rows = analytics?.byCategory ?? [];
    return rows.slice(0, 4);
  }, [analytics]);

  const handleAddExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(newExpense.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Monto invalido",
        description: "Ingresa un monto mayor a 0.",
      });
      return;
    }
    if (!newExpense.category || !newExpense.description.trim()) {
      toast({
        variant: "destructive",
        title: "Datos incompletos",
        description: "Completa categoria y descripcion.",
      });
      return;
    }

    try {
      await addExpense({
        amount,
        category: newExpense.category as any,
        description: newExpense.description.trim(),
        context: newExpense.context,
      });
      toast({
        title: "Gasto registrado",
        description: "El gasto se guardo correctamente.",
      });
      setNewExpense({
        amount: "",
        category: "",
        description: "",
        context: "GENERAL",
      });
      setIsDialogOpen(false);
      setCurrentPage(1);
      await Promise.all([loadExpenses(), loadAnalytics()]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: error?.message ?? "Intenta nuevamente.",
      });
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await backendApi.expenses.remove(deleteTarget.id);
      toast({
        title: "Gasto eliminado",
        description: "El registro fue eliminado correctamente.",
      });
      setDeleteTarget(null);
      await Promise.all([loadExpenses(), loadAnalytics()]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description: error?.message ?? "Intenta nuevamente.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8 rounded-lg" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Gastos
            </h1>
          </div>
          <p className="text-muted-foreground">
            Contexto y analytics por periodo
          </p>
        </div>

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
                  <Label>Contexto</Label>
                  <select
                    value={newExpense.context}
                    onChange={(event) =>
                      setNewExpense((prev) => ({
                        ...prev,
                        context: event.target.value as ExpenseContext,
                      }))
                    }
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="GENERAL">General</option>
                    <option value="RETAIL">Minorista</option>
                    <option value="WHOLESALE">Mayorista</option>
                  </select>
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
                >
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
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
                <p className="text-xs text-muted-foreground mt-1">
                  {analyticsPeriod} - {CONTEXT_LABELS[contextFilter]}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorias</CardTitle>
            <PieChart className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.byCategory?.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Con movimiento</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Participacion por categoria
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            {topCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin datos</p>
            ) : (
              topCategories.map((row) => (
                <div key={row.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">
                      {getExpenseCategoryLabel(row.category)}
                    </span>
                    <span>{row?.sharePercent?.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(100, row.sharePercent)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>Listado de gastos</CardTitle>
            <div className="flex flex-wrap gap-2">
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
                value={contextFilter}
                onChange={(event) => {
                  setContextFilter(event.target.value as ContextFilter);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                {Object.entries(CONTEXT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
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

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar gastos..."
              className="pl-8"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
            />
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
                  <TableHead>Contexto</TableHead>
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
                  expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(
                          new Date(
                            expense.createdAt ?? expense.updatedAt ?? new Date()
                          ),
                          "dd/MM/yyyy HH:mm",
                          {
                            locale: es,
                          }
                        )}
                      </TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getExpenseCategoryLabel(expense.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {
                          CONTEXT_LABELS[
                            (expense.context ?? "GENERAL") as ContextFilter
                          ]
                        }
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(expense.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(expense)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
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

          <div className="mt-6 space-y-2">
            <p className="text-sm font-semibold">Evolucion</p>
            {isLoadingAnalytics ? (
              <BrandSpinner
                size="sm"
                label="Cargando evolucion..."
                layout="inline"
              />
            ) : (analytics?.evolution?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin datos de evolucion.
              </p>
            ) : (
              <div className="grid gap-2">
                {analytics?.evolution.map((point) => (
                  <div
                    key={point.period}
                    className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {point.period}
                    </span>
                    <div className="h-1.5 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            (point.total /
                              Math.max(
                                ...((analytics?.evolution ?? []).map(
                                  (entry) => entry.total
                                ) || [1]),
                                1
                              )) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <span>{formatMoney(point.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
