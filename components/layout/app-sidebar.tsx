"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Package,
  Bell,
  Settings,
  FileText,
  TrendingUp,
  UserCheck,
  CreditCard,
  Package2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { BusinessTypeSelector } from "@/components/business/business-type-selector";
import { UserProfile } from "@/components/layout/user-profile";
import { useBusiness } from "@/components/providers/business-provider";

import type { ISidebarMenu } from "@/types/Sidebar";

const businessMenus: { [key: string]: ISidebarMenu[] } = {
  retail: [
    { title: "Dashboard", url: "/", icon: BarChart3 },
    { title: "Punto de Venta", url: "/pos", icon: CreditCard },
    { title: "Productos", url: "/products", icon: Package },
    { title: "Inventario", url: "/inventory", icon: Package2 },
    { title: "Ventas", url: "/sales", icon: TrendingUp },
    { title: "Reportes", url: "/reports", icon: FileText },
  ],

};

export function AppSidebar() {
  const { businessType } = useBusiness();
  const pathname = usePathname();
  const menuItems = businessMenus[businessType];

  return (
    <Sidebar collapsible="icon" className="border-r bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border px-6 py-5">
        <BusinessTypeSelector />
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider mb-2">
            Navegación Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="w-full justify-start px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-semibold rounded-lg group"
                  >
                    <Link
                      href={item.url}
                      className="flex items-center gap-3 w-full"
                    >
                      <div className="flex h-5 w-5 items-center justify-center">
                        <item.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                      </div>
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider mb-2">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="w-full justify-start px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg group"
                >
                  <Link
                    href="/notifications"
                    className="flex items-center gap-3 w-full"
                  >
                    <div className="flex h-5 w-5 items-center justify-center">
                      <Bell className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                    </div>
                    <span className="truncate">Notificaciones</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="w-full justify-start px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg group"
                >
                  <Link
                    href="/users"
                    className="flex items-center gap-3 w-full"
                  >
                    <div className="flex h-5 w-5 items-center justify-center">
                      <UserCheck className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                    </div>
                    <span className="truncate">Usuarios</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="w-full justify-start px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg group"
                >
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 w-full"
                  >
                    <div className="flex h-5 w-5 items-center justify-center">
                      <Settings className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                    </div>
                    <span className="truncate">Configuración</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup> */}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <UserProfile />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
