"use client";

import { MetricsCards } from "./metrics-cards";
import { SalesChart } from "./sales-chart";
import { RecentActivity } from "./recent-activity";
import { QuickActions } from "./quick-actions";
import { InventoryKpisCards } from "./inventory-kpis-cards";
import { useBranch } from "../providers/business-provider";
import { useUser } from "../providers/user-provider";
import type { DashboardMetrics } from "@/lib/data-service";
import useSWR from "swr";
import { backendApi } from "@/lib/backend-api";
import type { StockSummaryResponse } from "@/lib/api-types";
import { normalizeSnapshotMetrics } from "@/lib/snapshot-metrics";

const emptyInventorySummary: StockSummaryResponse = {
  products: { total: 0, lowStock: 0 },
  inventoryValue: { cost: 0, retail: 0, wholesale: 0 },
  quantity: { total: 0 },
  categories: { total: 0, withProducts: 0, withStock: 0 },
};

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

  const { data: inventorySummary } = useSWR<StockSummaryResponse>(
    branchId ? ["inventory-summary", branchId, 5] : null,
    () => backendApi.stocks.summary({ lowStockThreshold: 5 }, branchId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      keepPreviousData: true,
    }
  );

  const currentData = branchMetrics ?? fallbackData;
  const currentInventorySummary = inventorySummary ?? emptyInventorySummary;

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
