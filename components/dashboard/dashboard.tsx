"use client";

import { DashboardMetrics } from "@/lib/data-service";
import { MetricsCards } from "./metrics-cards";
import { SalesChart } from "./sales-chart";
import { RecentActivity } from "./recent-activity";
import { QuickActions } from "./quick-actions";
import { useBranch } from "../providers/business-provider";

interface DashboardProps {
  retailData: DashboardMetrics;
  wholesaleData: DashboardMetrics;
}

export function Dashboard({ retailData, wholesaleData }: DashboardProps) {
  const { activeBranchId, availableBranches } = useBranch();

  const activeBranch = availableBranches.find((b) => b.id === activeBranchId);

  // const currentData = businessType === "wholesale" ? wholesaleData : retailData;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Dashboard - {activeBranch?.name}
          </h1>
          <p className="text-muted-foreground">Resumen de tu negocio</p>
        </div>
      </div>

      <MetricsCards metrics={retailData} type="retail" />

      <div className="space-y-6">
        <SalesChart />
        <RecentActivity />
      </div>

      <QuickActions />
    </div>
  );
}
