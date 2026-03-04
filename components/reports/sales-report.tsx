"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download } from "lucide-react";

import { useTransactions } from "@/components/providers/transactions-provider";
import { useBusiness } from "@/components/providers/business-provider";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export function SalesReport({ dateRange }: { dateRange: any }) {
  const { sales, isLoading } = useTransactions();
  const { businessType } = useBusiness();

  const filteredSales = sales.filter((sale) => {
    if (sale.businessType !== businessType) return false;
    if (!dateRange?.from) return true;
    const saleDate = new Date(sale.date);
    const from = new Date(dateRange.from);
    const to = dateRange.to ? new Date(dateRange.to) : new Date();
    return saleDate >= from && saleDate <= to;
  });

  const getSalesByDate = () => {
    const grouped: { [key: string]: number } = {};
    filteredSales.forEach((sale) => {
      const date = format(new Date(sale.date), "dd/MM", { locale: es });
      grouped[date] = (grouped[date] || 0) + sale.amount;
    });
    return Object.keys(grouped).map((key) => ({ name: key, total: grouped[key] }));
  };

  const getSalesByProduct = () => {
    const byProduct: Record<string, number> = {};
    filteredSales.forEach((sale) => {
      (sale.lineItems ?? []).forEach((item) => {
        const key = item.productId || "N/A";
        byProduct[key] = (byProduct[key] || 0) + item.quantity * item.price;
      });
    });

    return Object.entries(byProduct)
      .map(([productId, value]) => ({
        name: productId.slice(0, 8),
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  };

  const getSalesByPaymentMethod = () => {
    return [
      {
        name: "No informado",
        value: filteredSales.length,
      },
    ];
  };

  const totalRevenue = filteredSales.reduce((acc, sale) => acc + sale.amount, 0);
  const totalTransactions = filteredSales.length;
  const tableRows = filteredSales
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((sale) => ({
      fecha: format(new Date(sale.date), "dd/MM/yyyy HH:mm", { locale: es }),
      cliente: sale.customerName,
      vendedor: sale.userName,
      items: sale.items,
      total: Number(sale.amount).toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
      }),
    }));

  const exportColumns = [
    { key: "fecha", label: "Fecha" },
    { key: "cliente", label: "Cliente" },
    { key: "vendedor", label: "Vendedor" },
    { key: "items", label: "Items" },
    { key: "total", label: "Total" },
  ];

  const handleExport = (formatType: "csv" | "pdf") => {
    const payload = {
      filename: "reporte-ventas",
      title: "Reporte de Ventas",
      subtitle: "Ventas filtradas por periodo y tipo de negocio.",
      columns: exportColumns,
      rows: tableRows,
    };

    if (formatType === "csv") {
      exportRowsToCsv(payload);
      return;
    }
    exportRowsToPdf(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Periodo seleccionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Cargando datos de ventas...</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ventas por Periodo</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={getSalesByDate()}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                />
                <Bar dataKey="total" fill="#adfa1d" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Productos</CardTitle>
            <CardDescription>Productos mas vendidos en el periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={getSalesByProduct()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {getSalesByProduct().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Metodos de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getSalesByPaymentMethod()}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {getSalesByPaymentMethod().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
