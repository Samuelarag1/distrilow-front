"use client";

import { useEffect, useState, useMemo } from "react";
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
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { useTransactions } from "@/components/providers/transactions-provider";
import { useBusiness } from "@/components/providers/business-provider";
import { Download } from "lucide-react";
import { exportRowsToCsv, exportRowsToPdf } from "@/lib/report-export";

export function ClientsReport({ dateRange }: { dateRange: any }) {
    const { sales } = useTransactions();
    const { businessType } = useBusiness();

    const clientData = useMemo(() => {
        const clientMap: Record<string, number> = {};

        const filteredSales = sales.filter((sale) => {
            if (sale.businessType !== businessType) return false;
            if (sale.lifecycleStatus === "CANCELLED") return false;
            if (!dateRange?.from) return true;
            const saleDate = new Date(sale.date);
            const from = new Date(dateRange.from);
            const to = dateRange.to ? new Date(dateRange.to) : new Date();
            return saleDate >= from && saleDate <= to;
        });

        filteredSales.forEach((sale) => {
            const clientName = sale.customerName || "Cliente Final";
            clientMap[clientName] = (clientMap[clientName] || 0) + sale.amount;
        });

        return Object.entries(clientMap)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
    }, [sales, dateRange, businessType]);

    const exportRows = clientData.map((client, index) => ({
        posicion: index + 1,
        cliente: client.name,
        totalFacturado: Number(client.total).toLocaleString("es-AR", {
            style: "currency",
            currency: "ARS",
        }),
    }));

    const exportColumns = [
        { key: "posicion", label: "#" },
        { key: "cliente", label: "Cliente" },
        { key: "totalFacturado", label: "Total Facturado" },
    ];

    const handleExport = (formatType: "csv" | "pdf") => {
        const payload = {
            filename: "reporte-clientes",
            title: "Reporte de Clientes",
            subtitle: "Ranking de clientes por facturacion.",
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
                        <CardTitle className="text-sm font-medium">Total Clientes Activos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{clientData.length}</div>
                        <p className="text-xs text-muted-foreground">En el período seleccionado</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Top Clientes por Facturación</CardTitle>
                        <CardDescription>Clientes que más han comprado</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={clientData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="total" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={20} name="Total Facturado" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Detalle de Clientes</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {clientData.map((client, i) => (
                            <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                                        {i + 1}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">{client.name}</p>
                                    </div>
                                </div>
                                <div className="font-bold">
                                    ${client.total.toLocaleString()}
                                </div>
                            </div>
                        ))}
                        {clientData.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No hay datos de clientes disponibles.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
