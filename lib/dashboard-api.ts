// src/lib/dashboard-api.ts
import { apiClientFetch } from "@/lib/api-client";

export type BusinessType = "retail" | "wholesale";

export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  activeCustomers: number;
  lowStockItems: number;
  dailyCashbox?: number;
  walkInCustomers?: number;
  pendingBulkOrders?: number;
  creditUtilized?: number;
}

export const getDashboardMetrics = async (
  type: BusinessType
): Promise<DashboardMetrics> => {
  try {
    return await apiClientFetch.get<DashboardMetrics>(
      `/dashboard/metrics?type=${type}`
    );
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
    return await apiClientFetch.get<any[]>(`/sales/recent?type=${type}`);
  } catch (error) {
    console.error("Failed to fetch recent sales", error);
    return [];
  }
};
