import { apiClientFetch } from "./api-client";
import type { SnapshotMetricsResponse } from "./api-types";
import {
  normalizeSnapshotMetrics,
  type NormalizedSnapshotMetrics,
} from "./snapshot-metrics";

export type BusinessType = "retail" | "wholesale";

export type DashboardMetrics = NormalizedSnapshotMetrics;

export const getDashboardMetrics = async (
  type: BusinessType
): Promise<DashboardMetrics> => {
  void type;
  try {
    const response = await apiClientFetch.get<SnapshotMetricsResponse>(
      `/snapshots/metrics?period=monthly`,
      { branchScoped: false }
    );

    return normalizeSnapshotMetrics(response);
  } catch (error) {
    console.error(
      "Failed to fetch dashboard metrics, using fallback empty state",
      error
    );
    return normalizeSnapshotMetrics({});
  }
};

export const getRecentSales = async (type: BusinessType) => {
  void type;
  try {
    return await apiClientFetch.get(`/sales`);
  } catch (error) {
    console.error("Failed to fetch recent sales", error);
    return [];
  }
};
