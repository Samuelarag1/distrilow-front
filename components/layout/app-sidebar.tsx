"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Package,
  FileText,
  TrendingUp,
  UserCheck,
  CreditCard,
  Wallet,
  Package2,
  Receipt,
  MapPin,
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
import { UserProfile } from "@/components/layout/user-profile";
import { useUser } from "@/components/providers/user-provider";
import {
  canAccessExpenses,
  isManagementRole,
  isPosCashOnlyUser,
} from "@/lib/permissions";

import type { ISidebarMenu } from "@/types/Sidebar";
import { BranchSelector } from "../branchSelector/branchSelector";

const businessMenus: { [key: string]: ISidebarMenu[] } = {
  retail: [
    { title: "Dashboard", url: "/", icon: BarChart3 },
    { title: "Punto de Venta", url: "/pos", icon: CreditCard },
    { title: "Caja", url: "/cash", icon: Wallet },
    { title: "Productos", url: "/products", icon: Package },
    { title: "Inventario", url: "/inventory", icon: Package2 },
    { title: "Ventas", url: "/sales", icon: TrendingUp },
    { title: "Gastos", url: "/expenses", icon: Receipt },
    { title: "Reportes", url: "/reports", icon: FileText },
    { title: "Sucursales", url: "/branches", icon: MapPin },
  ],
};

export function AppSidebar() {
  const { currentUser, branches } = useUser();
  const pathname = usePathname();
  const branchesCount = branches.length;
  const role = currentUser?.role;
  const posCashOnly = isPosCashOnlyUser(role, branchesCount);
  const canSeeExpenses = canAccessExpenses(role, branchesCount);

  const menuItems = businessMenus.retail.filter((item) => {
    if (posCashOnly) {
      return item.url === "/pos" || item.url === "/cash";
    }

    if (!canSeeExpenses && item.url === "/expenses") {
      return false;
    }

    return true;
  });

  const canManageUsers = isManagementRole(role);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/70 bg-sidebar/95 backdrop-blur-sm"
    >
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2">
        <BranchSelector />
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
            Navegacion Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="group w-full justify-start rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground"
                  >
                    <Link
                      href={item.url}
                      className="flex w-full items-center gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                    >
                      <div className="flex h-5 w-5 items-center justify-center">
                        <item.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                      </div>
                      <span className="truncate group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canManageUsers && (
          <SidebarGroup className="mt-8">
            <SidebarGroupLabel className="mb-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
              Sistema
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/users"}
                    tooltip="Usuarios"
                    className="group w-full justify-start rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <Link
                      href="/users"
                      className="flex w-full items-center gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                    >
                      <div className="flex h-5 w-5 items-center justify-center">
                        <UserCheck className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                      </div>
                      <span className="truncate group-data-[collapsible=icon]:hidden">
                        Usuarios
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <UserProfile />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
