import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { EMPTY_DASHBOARD_METRICS } from "@/lib/data-service";

// The dashboard loads its metrics client-side, with the active branch of this
// tab. It used to pre-fetch them on the server, but the server only sees
// cookies (shared by every tab) and had to guess the branch — showing one
// branch's numbers under another's name until the client refreshed.
export default function HomePage() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-4 space-y-6 max-w-7xl">
              <Dashboard
                retailData={EMPTY_DASHBOARD_METRICS}
                wholesaleData={EMPTY_DASHBOARD_METRICS}
              />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
