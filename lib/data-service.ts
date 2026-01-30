
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

export const getDashboardMetrics = async (type: BusinessType): Promise<DashboardMetrics> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (type === "wholesale") {
    return {
      totalRevenue: 15600000,
      totalOrders: 45,
      activeCustomers: 120,
      lowStockItems: 12,
      pendingBulkOrders: 5,
      creditUtilized: 4500000,
    };
  }

  // Retail
  return {
    totalRevenue: 2450000,
    totalOrders: 320,
    activeCustomers: 850,
    lowStockItems: 25,
    dailyCashbox: 150000,
    walkInCustomers: 65,
  };
};

export const getRecentSales = async (type: BusinessType) => {
   await new Promise((resolve) => setTimeout(resolve, 500));
   return Array.from({ length: 5 }).map((_, i) => ({
      id: `sale-${i}`,
      customer: type === 'wholesale' ? `Mayorista S.A. ${i}` : `Cliente Final ${i}`,
      amount: type === 'wholesale' ? Math.random() * 100000 : Math.random() * 5000,
      status: "completed",
      date: new Date().toISOString(),
      items: Math.floor(Math.random() * 10) + 1
   }));
}
