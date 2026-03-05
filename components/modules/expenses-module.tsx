"use client";

import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Plus, Search, Receipt, Calendar, Tag, FileText } from "lucide-react";
import { useTransactions } from "@/components/providers/transactions-provider";
import { useBusiness } from "@/components/providers/business-provider";
import { useUser } from "@/components/providers/user-provider";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  EXPENSE_CATEGORY_OPTIONS,
  getExpenseCategoryLabel,
} from "@/lib/expense-categories";
import { BrandMark } from "@/components/common/brand-mark";
import { BrandSpinner } from "@/components/common/brand-spinner";

export function ExpensesModule() {
  const { expenses, addExpense, isLoading } = useTransactions();
  const { businessType } = useBusiness();
  const { branchId, branches } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [newExpense, setNewExpense] = useState({
    amount: "",
    category: "",
    description: "",
  });

  const filteredExpenses = expenses.filter((expense) => {
    const matchesType = expense.businessType === businessType;
    const normalizedQuery = searchQuery.toLowerCase();
    const matchesSearch =
      expense.description.toLowerCase().includes(normalizedQuery) ||
      expense.category.toLowerCase().includes(normalizedQuery) ||
      getExpenseCategoryLabel(expense.category).toLowerCase().includes(normalizedQuery);
    return matchesType && matchesSearch;
  });

  const totalExpenses = filteredExpenses.reduce(
    (acc, curr) => acc + curr.amount,
    0
  );

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedExpenses = useMemo(() => {
    const start = (currentPageSafe - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPageSafe]);

  const expensesByCategory = filteredExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const { getTotalSalesByType } = useTransactions();
  const totalSales = getTotalSalesByType(businessType);
  const expenseRatio = totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0;

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.amount || !newExpense.category || !newExpense.description)
      return;

    await addExpense({
      amount: parseFloat(newExpense.amount),
      category: newExpense.category,
      description: newExpense.description,
      businessType,
    });

    setNewExpense({ amount: "", category: "", description: "" });
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8 rounded-lg" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Gastos</h1>
          </div>
          <p className="text-muted-foreground">
            Gestiona los egresos de tu negocio
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
            <form onSubmit={handleAddExpense}>
              <DialogHeader>
                <DialogTitle>Registrar Gasto</DialogTitle>
                <DialogDescription>
                  Ingresa los detalles del nuevo gasto para el modo{" "}
                  {businessType === "retail" ? "Minorista" : "Mayorista"}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Monto</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      className="pl-7"
                      value={newExpense.amount}
                      onChange={(e) =>
                        setNewExpense({ ...newExpense, amount: e.target.value })
                      }
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={newExpense.category}
                      onValueChange={(value) =>
                        setNewExpense({ ...newExpense, category: value })
                      }
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Selecciona una categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">Descripcion</Label>
                    <Input
                      id="description"
                      value={newExpense.description}
                      onChange={(e) =>
                        setNewExpense({
                          ...newExpense,
                          description: e.target.value,
                        })
                      }
                      placeholder="Ej: Pago de luz Enero"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El gasto se registra en la sucursal activa:{" "}
                    {branches.find((branch) => branch.id === branchId)?.name ?? "Sin sucursal"}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Guardar Gasto</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <Receipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalExpenses.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Periodo actual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ratio Gasto/Venta
            </CardTitle>
            <Tag className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenseRatio.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              De los ingresos brutos
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Principales Categorias
            </CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {topCategories.length > 0 ? (
                topCategories.map(([cat, amount]) => (
                  <div key={cat} className="flex-1">
                    <div className="text-xs font-bold truncate">
                      {getExpenseCategoryLabel(cat)}
                    </div>
                    <div className="text-sm font-black text-primary">
                      ${amount.toLocaleString()}
                    </div>
                    <div className="w-full bg-muted h-1 rounded-full mt-1 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all"
                        style={{ width: `${(amount / totalExpenses) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sin datos de categorias
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>Historial de Gastos</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar gastos..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <div className="rounded-md border p-4 text-center">
                <BrandSpinner size="sm" label="Cargando gastos..." layout="inline" />
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                No se encontraron gastos registrados.
              </div>
            ) : (
              paginatedExpenses.map((expense) => (
                <div key={expense.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium break-words">{expense.description}</span>
                    <span className="font-bold whitespace-nowrap">
                      ${expense.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {format(new Date(expense.date), "dd/MM/yyyy HH:mm", {
                        locale: es,
                      })}
                    </span>
                    <Badge variant="secondary" className="font-normal">
                      <Tag className="mr-1 h-3 w-3" />
                      {getExpenseCategoryLabel(expense.category)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Ref: {expense.id}</p>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <div className="flex items-center justify-center">
                        <BrandSpinner size="sm" label="Cargando gastos..." layout="inline" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No se encontraron gastos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(expense.date), "dd/MM/yyyy HH:mm", {
                              locale: es,
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{expense.description}</span>
                          <span className="text-xs text-muted-foreground">
                            Ref: {expense.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          <Tag className="mr-1 h-3 w-3" />
                          {getExpenseCategoryLabel(expense.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ${expense.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {!isLoading && filteredExpenses.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Pagina {currentPageSafe} de {totalPages} ({filteredExpenses.length} registros)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(1, currentPageSafe - 1))}
                  disabled={currentPageSafe <= 1}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPageSafe + 1))}
                  disabled={currentPageSafe >= totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
