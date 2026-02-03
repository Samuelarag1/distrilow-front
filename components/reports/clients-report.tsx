"use client";

import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

interface Sale {
    id: string;
    total: number;
    client?: {
        id: string;
        name: string;
    };
    createdAt: string;
}

export function ClientsReport({ dateRange }: { dateRange: any }) {
    const [sales, setSales] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("/api/sales");
                if (!response.ok) throw new Error("Failed to fetch sales");
                const data = await response.json();
                setSales(data);
            } catch (error) {
                toast({
                    title: "Error",
                    description: "No se pudieron cargar los datos de clientes.",
                    variant: "destructive",
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [toast]);

    const getClientRanking = () => {
        const clientMap: Record<string, number> = {};
        const filteredSales = sales.filter((sale) => {
            if (!dateRange?.from) return true;
            const saleDate = new Date(sale.createdAt);
            const from = new Date(dateRange.from);
            const to = dateRange.to ? new Date(dateRange.to) : new Date();
            return saleDate >= from && saleDate <= to;
        });

        filteredSales.forEach((sale) => {
            const clientName = sale.client?.name || "Cliente Final";
            clientMap[clientName] = (clientMap[clientName] || 0) + sale.total;
        });

        return Object.entries(clientMap)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
    };

    const clientData = getClientRanking();

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Cargando reporte de clientes...</div>;
    }

    return (
        <div className="space-y-4">
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
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip formatter={(value) => `$${value}`} cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="total" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={20} name="Total Facturado" />
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
