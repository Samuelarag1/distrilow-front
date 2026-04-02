"use client";

import { useCallback, useEffect, useRef } from "react";
import { MetricsCards } from "./metrics-cards";
import { SalesChart } from "./sales-chart";
import { RecentActivity } from "./recent-activity";
import { QuickActions } from "./quick-actions";
import { useBranch } from "../providers/business-provider";
import { useUser } from "../providers/user-provider";
import { subscribeCashSync } from "@/lib/cash-live-sync";
import type { DashboardMetrics } from "@/lib/data-service";
import useSWR from "swr";
import { backendApi } from "@/lib/backend-api";
import { subscribeExpensesSync } from "@/lib/expenses-live-sync";
import { subscribeSalesSync } from "@/lib/sales-live-sync";
import {
  formatSnapshotRangeLabel,
  normalizeSnapshotMetrics,
  SNAPSHOT_REPORTING_TIME_ZONE,
} from "@/lib/snapshot-metrics";

interface DashboardProps {
  retailData: DashboardMetrics;
  wholesaleData: DashboardMetrics;
}

export function Dashboard({ retailData, wholesaleData }: DashboardProps) {
  const { activeBranchId, availableBranches, businessType } = useBranch();
  const { branchId } = useUser();
  const lastValidatedBranchIdRef = useRef<string | null>(null);
  const lastRefreshAtRef = useRef(0);

  const activeBranch = availableBranches.find((b) => b.id === activeBranchId);
  const fallbackData =
    businessType === "wholesale" ? wholesaleData : retailData;

  const { data: branchMetrics, mutate: mutateBranchMetrics } = useSWR<DashboardMetrics>(
    branchId ? ["reporting-dashboard-summary", branchId] : null,
    async () => {
      const snapshot = await backendApi.reporting.dashboard.summary({
        period: "monthly",
        scope: "active",
      }, branchId);
      return normalizeSnapshotMetrics(snapshot);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateOnMount: false,
      revalidateIfStale: false,
      keepPreviousData: true,
      fallbackData,
      dedupingInterval: 60_000,
    }
  );

  const requestSummaryRefresh = useCallback(
    (force = false) => {
      const now = Date.now();
      if (!force && now - lastRefreshAtRef.current < 1_000) return;

      lastRefreshAtRef.current = now;
      void mutateBranchMetrics();
    },
    [mutateBranchMetrics]
  );

  useEffect(() => {
    if (!branchId) {
      lastValidatedBranchIdRef.current = null;
      lastRefreshAtRef.current = 0;
      return;
    }

    if (lastValidatedBranchIdRef.current === branchId) return;

    lastValidatedBranchIdRef.current = branchId;
    requestSummaryRefresh(true);
  }, [branchId, requestSummaryRefresh]);

  useEffect(() => {
    if (!branchId) return;

    const matchesCurrentBranch = (payloadBranchId: string | null) =>
      !payloadBranchId || payloadBranchId === branchId;

    const unsubSales = subscribeSalesSync((payload) => {
      if (!matchesCurrentBranch(payload.branchId)) return;
      requestSummaryRefresh();
    });
    const unsubExpenses = subscribeExpensesSync((payload) => {
      if (!matchesCurrentBranch(payload.branchId)) return;
      requestSummaryRefresh();
    });
    const unsubCash = subscribeCashSync((payload) => {
      if (!matchesCurrentBranch(payload.branchId)) return;
      requestSummaryRefresh();
    });

    return () => {
      unsubSales();
      unsubExpenses();
      unsubCash();
    };
  }, [branchId, requestSummaryRefresh]);

  const currentData = branchMetrics ?? fallbackData;
  const rangeLabel = formatSnapshotRangeLabel(currentData.range);
  const summaryCaption = rangeLabel
    ? `Mes en curso real (${SNAPSHOT_REPORTING_TIME_ZONE}): ${rangeLabel}`
    : "Resumen de tu negocio";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Dashboard - {activeBranch?.name}
          </h1>
          <p className="text-muted-foreground">{summaryCaption}</p>
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
