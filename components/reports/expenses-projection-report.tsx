"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Download } from "lucide-react";
import useSWR from "swr";

import { useUser } from "@/components/providers/user-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Expense } from "@/lib/api-types";
import { backendApi } from "@/lib/backend-api";
import { subscribeExpensesSync } from "@/lib/expenses-live-sync";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";

const REPORT_PAGE_SIZE = 200;

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

function formatInputDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function getExpenseDateValue(expense: Expense) {
  return expense.createdAt ?? expense.updatedAt ?? null;
}

function getExpenseTimestamp(expense: Expense) {
  const value = getExpenseDateValue(expense);
  if (!value) return Number.MAX_SAFE_INTEGER;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function formatExpenseDate(value: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return format(date, "dd/MM/yyyy HH:mm", { locale: es });
}

async function fetchExpensesForRange(
  branchId: string,
  from: string,
  to: string,
) {
  const expenses: Expense[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await backendApi.expenses.list(
      {
        skip,
        take: REPORT_PAGE_SIZE,
        from,
        to,
      },
      branchId,
    );

    expenses.push(...page.items);

    if (!page.meta.hasMore || page.items.length === 0) {
      hasMore = false;
      continue;
    }

    skip += Math.max(Number(page.meta.limit ?? REPORT_PAGE_SIZE), 1);
  }

  return expenses;
}

export function ExpensesProjectionReport() {
  const { branchId } = useUser();
  const lastSyncAtRef = useRef(0);

  const [from, setFrom] = useState(() =>
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const hasInvalidRange = from > to;

  const {
    data: expenses = [],
    isLoading,
    error,
    mutate,
  } = useSWR(
    branchId && !hasInvalidRange
      ? ["reporting-expenses-list", branchId, from, to]
      : null,
    () => fetchExpensesForRange(branchId ?? "", from, to),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 2_500,
    },
  );

  useEffect(() => {
    if (!branchId) return;

    return subscribeExpensesSync((payload) => {
      if (payload.branchId && payload.branchId !== branchId) return;

      const now = Date.now();
      if (now - lastSyncAtRef.current < 1_000) return;

      lastSyncAtRef.current = now;
      void mutate();
    });
  }, [branchId, mutate]);

  const tableRows = useMemo(
    () =>
      [...expenses]
        .sort((left, right) => getExpenseTimestamp(left) - getExpenseTimestamp(right))
        .map((expense) => ({
          id: expense.id,
          fecha: formatExpenseDate(getExpenseDateValue(expense)),
          gasto: expense.description?.trim() || "Sin descripcion",
          total: Number(expense.amount ?? 0),
        })),
    [expenses],
  );

  const totals = useMemo(
    () => ({
      count: tableRows.length,
      amount: tableRows.reduce((sum, row) => sum + row.total, 0),
    }),
    [tableRows],
  );

  const exportRows = useMemo(
    () =>
      tableRows.map((row) => ({
        fecha: row.fecha,
        gasto: row.gasto,
        total: formatMoney(row.total),
      })),
    [tableRows],
  );

  const exportColumns = [
    { key: "fecha", label: "Fecha" },
    { key: "gasto", label: "Gasto" },
    { key: "total", label: "Total", align: "right" as const },
  ];

  const handleExport = (formatType: "csv" | "pdf") => {
    const payload = {
      filename: "reporte-gastos-detallado",
      title: "Reporte de Gastos",
      subtitle: `Listado real de gastos del ${formatInputDate(from)} al ${formatInputDate(to)}.`,
      summary: [
        { label: "Rango", value: `${formatInputDate(from)} al ${formatInputDate(to)}` },
        { label: "Gastos", value: String(totals.count) },
        { label: "Total acumulado", value: formatMoney(totals.amount) },
      ],
      columns: exportColumns,
      rows: exportRows,
    };

    if (formatType === "csv") {
      exportRowsToCsv(payload);
      return;
    }

    exportRowsToPdf(payload);
  };

  if (!branchId) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Selecciona una sucursal activa para ver el listado de gastos.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => handleExport("csv")}
          disabled={hasInvalidRange || exportRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => handleExport("pdf")}
          disabled={hasInvalidRange || exportRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de gastos</CardTitle>
          <CardDescription>
            Consulta gastos reales del periodo. El PDF exporta solo fecha, gasto
            y total.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Gastos encontrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.count.toLocaleString("es-AR")}
            </div>
            <p className="text-xs text-muted-foreground">Rango seleccionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totals.amount)}
            </div>
            <p className="text-xs text-muted-foreground">Rango seleccionado</p>
          </CardContent>
        </Card>
      </div>

      {hasInvalidRange && (
        <p className="text-sm text-destructive">
          La fecha desde no puede ser posterior a la fecha hasta.
        </p>
      )}

      {isLoading && !hasInvalidRange && (
        <p className="text-sm text-muted-foreground">
          Cargando listado real de gastos...
        </p>
      )}

      {!isLoading && !hasInvalidRange && error && (
        <p className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "No se pudo cargar el listado de gastos."}
        </p>
      )}

      {!isLoading && !error && !hasInvalidRange && (
        <Card>
          <CardHeader>
            <CardTitle>Gastos del periodo</CardTitle>
            <CardDescription>
              {totals.count === 0
                ? "No hay gastos cargados en este rango."
                : `${totals.count.toLocaleString("es-AR")} gastos listados en orden cronologico.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tableRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay gastos para el rango seleccionado.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Fecha</TableHead>
                      <TableHead>Gasto</TableHead>
                      <TableHead className="w-[160px] text-right">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {row.fecha}
                        </TableCell>
                        <TableCell className="align-top">{row.gasto}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-medium">
                          {formatMoney(row.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold">
                        Total acumulado
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(totals.amount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
