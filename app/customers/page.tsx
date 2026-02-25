"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { UnderDevelopment } from "@/components/common/under-development";
import { BusinessProvider } from "@/components/providers/business-provider";

export default function CustomersPage() {
  return (
    <BusinessProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col min-w-0">
            <Header />
            <main className="flex-1 overflow-auto">
              <div className="container mx-auto p-4 space-y-6 max-w-7xl">
                <UnderDevelopment
                  title="Gestión de Clientes"
                  description="Módulo para gestionar clientes, historial de compras y datos de contacto"
                  features={[
                    "Base de datos de clientes",
                    "Historial de compras",
                    "Información de contacto",
                    "Segmentación de clientes",
                    "Reportes de fidelización",
                  ]}
                />
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </BusinessProvider>
  );
}
