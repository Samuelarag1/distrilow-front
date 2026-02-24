import { apiClientFetch } from "./api-client";

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
  type: BusinessType,
): Promise<DashboardMetrics> => {
  try {
    const response = await apiClientFetch(`/dashboard/metrics?type=${type}`);
    return await response.json();
  } catch (error) {
    console.error(
      "Failed to fetch dashboard metrics, using fallback empty state",
      error,
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
    const response = await apiClientFetch(`/sales/recent?type=${type}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch recent sales", error);
    return [];
  }
};
