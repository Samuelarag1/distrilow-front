"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { ProfileModule } from "@/components/modules/profile-module";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function ProfilePage() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0 flex flex-col">
          <Header />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto max-w-7xl space-y-6 p-4">
              <ProfileModule />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
