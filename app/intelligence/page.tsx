"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { IntelligenceView } from "@/components/intelligence/intelligence-view";

export default function IntelligencePage() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/50">
            <IntelligenceView />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
