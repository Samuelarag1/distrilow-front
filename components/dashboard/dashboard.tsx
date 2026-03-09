"use client";

import { MetricsCards } from "./metrics-cards";
import { SalesChart } from "./sales-chart";
import { RecentActivity } from "./recent-activity";
import { QuickActions } from "./quick-actions";
import { useBranch } from "../providers/business-provider";
import { useUser } from "../providers/user-provider";
import type { DashboardMetrics } from "@/lib/data-service";
import useSWR from "swr";
import { backendApi } from "@/lib/backend-api";
import { normalizeSnapshotMetrics } from "@/lib/snapshot-metrics";

interface DashboardProps {
  retailData: DashboardMetrics;
  wholesaleData: DashboardMetrics;
}

export function Dashboard({ retailData, wholesaleData }: DashboardProps) {
  const { activeBranchId, availableBranches, businessType } = useBranch();
  const { branchId } = useUser();

  const activeBranch = availableBranches.find((b) => b.id === activeBranchId);
  const fallbackData =
    businessType === "wholesale" ? wholesaleData : retailData;

  const { data: branchMetrics } = useSWR<DashboardMetrics>(
    branchId ? ["dashboard-metrics", branchId, businessType] : null,
    async () => {
      const snapshot = await backendApi.snapshots.metrics("monthly");
      return normalizeSnapshotMetrics(snapshot);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      keepPreviousData: false,
    }
  );

  const currentData = branchMetrics ?? fallbackData;

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

      <MetricsCards metrics={currentData} type={businessType} />

      <div className="space-y-6">
        <SalesChart />
        <RecentActivity />
      </div>

      <QuickActions />
    </div>
  );
}
