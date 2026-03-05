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
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import useSWR from "swr";

import { useProducts } from "@/components/providers/product-provider";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";
import { swrFetcher } from "@/lib/swr-fetcher";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

type Category = {
  id: string;
  name: string;
  isActive?: boolean;
};

export function StockReport() {
  const { products } = useProducts({ take: 500, skip: 0 });
  const { data: categoriesData } = useSWR<Category[]>("/categories", swrFetcher);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    (categoriesData ?? []).forEach((category) => {
      if (category?.id && category?.name) {
        map.set(category.id, category.name);
      }
    });
    return map;
  }, [categoriesData]);

  const getCategoryLabel = (item: {
    category?: string;
    categoryId?: string | null;
  }) => {
    if (item.categoryId) {
      return categoryNameById.get(item.categoryId) ?? "Sin categoria";
    }

    const raw = String(item.category ?? "").trim();
    if (!raw || raw === "Sin categoria") return "Sin categoria";

    const mappedFromRaw = categoryNameById.get(raw);
    if (mappedFromRaw) return mappedFromRaw;

    const looksLikeId =
      /^[a-f0-9-]{12,}$/i.test(raw) || /^[a-z0-9]{10,}$/i.test(raw);
    if (looksLikeId) return "Sin categoria";

    return raw;
  };

  const totalValue = products.reduce((acc, item) => acc + item.stock * item.price, 0);
  const lowStockItems = products.filter((item) => item.stock <= (item.minStock || 0));

  const stockByCategory = products.reduce((acc, item) => {
    const categoryLabel = getCategoryLabel(item);
    acc[categoryLabel] = (acc[categoryLabel] || 0) + item.stock;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.keys(stockByCategory).map((key) => ({
    name: key,
    value: stockByCategory[key],
  }));

  const chartData = products.map((p) => ({
    name: p.name,
    stock: p.stock,
    min: p.minStock || 0,
  }));

  const exportRows = products.map((item) => ({
    producto: item.name,
    categoria: getCategoryLabel(item),
    stock: item.stock,
    stockMinimo: item.minStock || 0,
    precio: Number(item.price || 0).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
    }),
    valorTotal: Number(item.stock * item.price).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
    }),
  }));

  const exportColumns = [
    { key: "producto", label: "Producto" },
    { key: "categoria", label: "Categoria" },
    { key: "stock", label: "Stock" },
    { key: "stockMinimo", label: "Stock Minimo" },
    { key: "precio", label: "Precio" },
    { key: "valorTotal", label: "Valor Total" },
  ];

  const handleExport = (formatType: "csv" | "pdf") => {
    const payload = {
      filename: "reporte-inventario",
      title: "Reporte de Inventario",
      subtitle: "Estado actual de stock por producto.",
      columns: exportColumns,
      rows: exportRows,
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
        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => handleExport("csv")}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => handleExport("pdf")}>
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor del Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Items Stock Bajo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{lowStockItems.length}</div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Niveles de Stock por Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickCount={6} />
                  <Tooltip cursor={{ fill: "transparent" }} />
                  <Bar dataKey="stock" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Unidades" barSize={30} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Composicion por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
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

      <Card>
        <CardHeader>
          <CardTitle>Alertas de Reposicion</CardTitle>
          <CardDescription>Productos que requieren atencion inmediata</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{getCategoryLabel(item)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-red-500 font-bold">
                    {item.stock} / {item.minStock || 0} (Min)
                  </div>
                  <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(item.stock / (item.minStock || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {lowStockItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Todo el stock esta en niveles optimos.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
