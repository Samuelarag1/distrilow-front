"use client";

import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { useBusiness } from "@/components/providers/business-provider";
import { DashboardMetrics } from "@/lib/data-service";
interface DashboardProps {
  retailData: DashboardMetrics;
  wholesaleData: DashboardMetrics;
}

export function Dashboard({ retailData, wholesaleData }: DashboardProps) {
  const { businessType } = useBusiness();
  const currentData = businessType === "wholesale" ? wholesaleData : retailData;

  return (
    <div className="space-y-6">
      {/* <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Dashboard -{" "}
            {businessType === "retail"
              ? "Distribuidora Minorista"
              : "Distribuidora Mayorista"}
          </h1>
          <p className="text-muted-foreground">Resumen de tu negocio</p>
        </div>
      </div>

      {/* <MetricsCards metrics={currentData} type={businessType} /> */}
      <div className="space-y-6">
        {/* <SalesChart />
        <RecentActivity /> */}
      </div>
      {/* <QuickActions />  */}
      hola
    </div>
  );
}
