"use client";

import { useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import { History, ShieldCheck, Users, Download } from "lucide-react";
import { SalesReport } from "./sales-report";
import { StockReport } from "./stock-report";
import { ClientsReport } from "./clients-report";
import { ReportsModule } from "@/components/modules/reports-module";

export function ReportsView() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: new Date(new Date().setDate(new Date().getDate() - 30)),
        to: new Date(),
    });

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Reportes</h2>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Exportar
                    </Button>
                </div>
            </div>
            <Tabs defaultValue="sales" className="space-y-4">
                <TabsList className="bg-muted p-1">
                    <TabsTrigger value="sales">Ventas</TabsTrigger>
                    <TabsTrigger value="stock">Inventario</TabsTrigger>
                    <TabsTrigger value="clients">Clientes</TabsTrigger>
                    <TabsTrigger value="audit">Auditoría</TabsTrigger>
                    <TabsTrigger value="cashiers">Personal</TabsTrigger>
                </TabsList>
                <TabsContent value="sales" className="space-y-4">
                    <SalesReport dateRange={dateRange} />
                </TabsContent>
                <TabsContent value="stock" className="space-y-4">
                    <StockReport />
                </TabsContent>
                <TabsContent value="clients" className="space-y-4">
                    <ClientsReport dateRange={dateRange} />
                </TabsContent>
                <TabsContent value="audit" className="space-y-4">
                    <ReportsModule />
                </TabsContent>
                <TabsContent value="cashiers" className="space-y-4">
                    <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                        Utiliza la pestaña de Auditoría para ver el rendimiento por cajero.
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Temporary type definition if not available globally
type DateRange = {
    from: Date | undefined;
    to?: Date | undefined;
};
