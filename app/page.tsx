import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { Dashboard } from "@/components/dashboard/dashboard";
import {
  EMPTY_DASHBOARD_METRICS,
  DashboardContractError,
  parseDashboardMetrics,
  type DashboardMetrics,
} from "@/lib/data-service";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

async function getMetrics(): Promise<DashboardMetrics> {
  try {
    const snapshot = await serverApi.get(
      "/reporting/dashboard/summary?period=monthly&scope=active"
    );
    return parseDashboardMetrics(snapshot);
  } catch (error) {
    return {
      ...EMPTY_DASHBOARD_METRICS,
      contractError:
        error instanceof DashboardContractError
          ? error.message
          : "No se pudo cargar el resumen del dashboard.",
    };
  }
}

export default async function HomePage() {
  const metrics = await getMetrics();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-4 space-y-6 max-w-7xl">
              <Dashboard retailData={metrics} wholesaleData={metrics} />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
