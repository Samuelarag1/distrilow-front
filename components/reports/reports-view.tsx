"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesReport } from "./sales-report";
import { StockReport } from "./stock-report";
import { ClientsReport } from "./clients-report";
import { ReportsModule } from "@/components/modules/reports-module";

export function ReportsView() {
  const [dateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Reportes
        </h2>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="stock">Inventario</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
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
      </Tabs>
    </div>
  );
}

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};
