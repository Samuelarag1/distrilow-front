import { apiClientFetch } from "./api-client";
import type { SnapshotMetricsResponse } from "./api-types";

export type BusinessType = "retail" | "wholesale";

export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  activeCustomers: number;
  lowStockItems: number;
  // Retail specific
  dailyCashbox?: number;
  walkInCustomers?: number;
  // Wholesale specific
  pendingBulkOrders?: number;
  creditUtilized?: number;
}

export const getDashboardMetrics = async (
  type: BusinessType
): Promise<DashboardMetrics> => {
  try {
    const response = await apiClientFetch.get<SnapshotMetricsResponse>(
      `/snapshots/metrics?period=monthly`,
      { branchScoped: false }
    );

    return {
      totalRevenue: Number(response.totalRevenue ?? 0),
      totalOrders: Number(response.totalOrders ?? 0),
      activeCustomers: Number(response.activeCustomers ?? 0),
      lowStockItems: Number(response.lowStockItems ?? 0),
      dailyCashbox: Number(response.dailyCashbox ?? 0),
      walkInCustomers: Number(response.walkInCustomers ?? 0),
      pendingBulkOrders: Number(response.pendingBulkOrders ?? 0),
      creditUtilized: Number(response.creditUtilized ?? 0),
    };
  } catch (error) {
    console.error(
      "Failed to fetch dashboard metrics, using fallback empty state",
      error
    );
    return {
      totalRevenue: 0,
      totalOrders: 0,
      activeCustomers: 0,
      lowStockItems: 0,
    };
  }
};

export const getRecentSales = async (type: BusinessType) => {
  try {
    return await apiClientFetch.get(`/sales`);
  } catch (error) {
    console.error("Failed to fetch recent sales", error);
    return [];
  }
};
