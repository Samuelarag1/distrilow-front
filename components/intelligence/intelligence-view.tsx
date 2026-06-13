"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CISummaryCards } from "./ci-summary-cards";
import { ParetoReport } from "./pareto-report";
import { SlowMoversReport } from "./slow-movers-report";
import { HourlySalesReport } from "./hourly-sales-report";
import { ProductVelocityReport } from "./product-velocity-report";
import { StockBreakReport } from "./stock-break-report";
import { ProductInspector } from "./product-inspector";

const CI_TABS = new Set(["pareto", "slowMovers", "hourly", "velocity", "stockBreaks", "product"]);

export function IntelligenceView() {
  const [activeTab, setActiveTab] = useState("pareto");

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h2 className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Análisis Comercial
        </h2>
      </div>

      {/* <CISummaryCards /> */}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted p-1">
          <TabsTrigger className="shrink-0" value="pareto">
            Pareto 80/20
          </TabsTrigger>
          <TabsTrigger className="shrink-0" value="slowMovers">
            Baja Rotación
          </TabsTrigger>
          {/* <TabsTrigger className="shrink-0" value="hourly">
            Ventas por Hora
          </TabsTrigger> */}
          {/* <TabsTrigger className="shrink-0" value="velocity">
            Velocidad ABC
          </TabsTrigger> */}
          <TabsTrigger className="shrink-0" value="stockBreaks">
            Quiebres de Stock
          </TabsTrigger>
          <TabsTrigger className="shrink-0" value="product">
            Detalle Producto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pareto" className="space-y-4">
          <ParetoReport />
        </TabsContent>
        <TabsContent value="slowMovers" className="space-y-4">
          <SlowMoversReport />
        </TabsContent>
        <TabsContent value="hourly" className="space-y-4">
          <HourlySalesReport />
        </TabsContent>
        <TabsContent value="velocity" className="space-y-4">
          <ProductVelocityReport />
        </TabsContent>
        <TabsContent value="stockBreaks" className="space-y-4">
          <StockBreakReport />
        </TabsContent>
        <TabsContent value="product" className="space-y-4">
          <ProductInspector />
        </TabsContent>
      </Tabs>
    </div>
    </TooltipProvider>
  );
}
