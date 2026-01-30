import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { BusinessProvider } from "@/components/providers/business-provider";
import { getDashboardMetrics } from "@/lib/data-service";

export const dynamic = 'force-dynamic'; // SSR

export default async function HomePage() {
  // Parallel fetching of data for both modes (SSR)
  const [retailMetrics, wholesaleMetrics] = await Promise.all([
    getDashboardMetrics("retail"),
    getDashboardMetrics("wholesale")
  ]);

  return (
    <BusinessProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col min-w-0">
            <Header />
            <main className="flex-1 overflow-auto">
              <div className="container mx-auto p-4 space-y-6 max-w-7xl">
                <Dashboard retailData={retailMetrics} wholesaleData={wholesaleMetrics} />
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </BusinessProvider>
  );
}
