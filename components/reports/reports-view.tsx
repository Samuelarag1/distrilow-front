"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesReport } from "./sales-report";
import { StockReport } from "./stock-report";
import { CashCalendarReport } from "./cash-calendar-report";
import { ExpensesProjectionReport } from "./expenses-projection-report";
import { StockMovementsReport } from "./stock-movements-report";
import { getRollingMonthRange } from "@/lib/reports/rolling-month";

const REPORT_TABS = new Set([
  "cashCalendar",
  "sales",
  "stock",
  "stockMovements",
  "expenses",
]);

export function ReportsView() {
  const searchParams = useSearchParams();
  const dateRange = useMemo<DateRange>(() => getRollingMonthRange(), []);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabParam && REPORT_TABS.has(tabParam) ? tabParam : "cashCalendar"
  );

  return (
    <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Reportes
        </h2>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted p-1">
          <TabsTrigger className="shrink-0" value="cashCalendar">
            Cajas del mes
          </TabsTrigger>
          <TabsTrigger className="shrink-0" value="sales">
            Ventas
          </TabsTrigger>
          <TabsTrigger className="shrink-0" value="stock">
            Inventario
          </TabsTrigger>
          <TabsTrigger className="shrink-0" value="stockMovements">
            Movimientos de Stock
          </TabsTrigger>
          <TabsTrigger className="shrink-0" value="expenses">
            Gastos
          </TabsTrigger>
          {/* <TabsTrigger className="shrink-0" value="clients">
            Clientes
          </TabsTrigger> */}
          {/* <TabsTrigger className="shrink-0" value="audit">
            Auditoria
          </TabsTrigger> */}
        </TabsList>

        <TabsContent value="cashCalendar" className="space-y-4">
          <CashCalendarReport />
        </TabsContent>
        <TabsContent value="sales" className="space-y-4">
          <SalesReport dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="stock" className="space-y-4">
          <StockReport />
        </TabsContent>
        <TabsContent value="stockMovements" className="space-y-4">
          <StockMovementsReport />
        </TabsContent>
        <TabsContent value="expenses" className="space-y-4">
          <ExpensesProjectionReport />
        </TabsContent>
        {/* <TabsContent value="clients" className="space-y-4">
          <ClientsReport dateRange={dateRange} />
        </TabsContent> */}
        {/* <TabsContent value="audit" className="space-y-4">
          <ReportsModule />
        </TabsContent> */}
      </Tabs>
    </div>
  );
}

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};
