"use client";

import { useMemo } from "react";
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
import useSWR from "swr";

import { useTransactions } from "@/components/providers/transactions-provider";
import { useBusiness } from "@/components/providers/business-provider";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";
import { backendApi } from "@/lib/backend-api";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export function SalesReport({ dateRange }: { dateRange: any }) {
  const { sales, isLoading } = useTransactions();
  const { businessType } = useBusiness();

  const { data: productsPayload } = useSWR(
    "sales-report-products",
    () => backendApi.products.list({ skip: 0, take: 500 }),
    { revalidateOnFocus: false }
  );

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    (productsPayload?.items ?? []).forEach((product) => {
      if (product?.id && product?.name) {
        map.set(product.id, product.name);
      }
    });
    return map;
  }, [productsPayload]);

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        if (sale.businessType !== businessType) return false;
        if (!dateRange?.from) return true;
        const saleDate = new Date(sale.date);
        const from = new Date(dateRange.from);
        const to = dateRange.to ? new Date(dateRange.to) : new Date();
        return saleDate >= from && saleDate <= to;
      }),
    [sales, businessType, dateRange]
  );

  const salesByDate = useMemo(() => {
    const grouped: { [key: string]: number } = {};
    filteredSales.forEach((sale) => {
      const date = format(new Date(sale.date), "dd/MM", { locale: es });
      grouped[date] = (grouped[date] || 0) + sale.amount;
    });
    return Object.keys(grouped).map((key) => ({ name: key, total: grouped[key] }));
  }, [filteredSales]);

  const topProducts = useMemo(() => {
    const byProduct: Record<string, number> = {};

    filteredSales.forEach((sale) => {
      (sale.lineItems ?? []).forEach((item) => {
        const lineItem = item as {
          productId?: string;
          productName?: string;
          name?: string;
          quantity: number;
          price: number;
        };

        const productLabel =
          lineItem.productName?.trim() ||
          lineItem.name?.trim() ||
          (lineItem.productId ? productNameById.get(lineItem.productId) : undefined) ||
          "Producto sin nombre";

        byProduct[productLabel] =
          (byProduct[productLabel] || 0) + lineItem.quantity * lineItem.price;
      });
    });

    return Object.entries(byProduct)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredSales, productNameById]);

  const salesByPaymentMethod = useMemo(
    () => [
      {
        name: "No informado",
        value: filteredSales.length,
      },
    ],
    [filteredSales.length]
  );

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
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => handleExport("csv")}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => handleExport("pdf")}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Ventas por Periodo</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[260px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByDate}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="total" fill="#adfa1d" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Top Productos</CardTitle>
            <CardDescription>Productos mas vendidos en el periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topProducts}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Metodos de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesByPaymentMethod}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {salesByPaymentMethod.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
