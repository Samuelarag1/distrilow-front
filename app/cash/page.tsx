"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { CashModule } from "@/components/modules/cash-module";

export default function CashPage() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="min-w-0 flex flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto max-w-7xl space-y-6 p-4">
              <CashModule />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
