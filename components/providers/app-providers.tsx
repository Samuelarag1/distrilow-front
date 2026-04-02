"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SWRConfig } from "swr";

import { BusinessProvider } from "./business-provider";
import { TransactionsProvider } from "./transactions-provider";
import { ProductProvider } from "./product-provider";
import { UserProvider } from "./user-provider";
import { AuditProvider } from "./audit-provider";
import { OfflineProvider } from "./offline-provider";
import { BranchProvider } from "./branch-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPosRoute = pathname === "/pos" || pathname.startsWith("/pos/");
  const shouldHydrateSales =
    pathname === "/sales" || pathname.startsWith("/sales/");

  if (isPosRoute) {
    return (
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
          shouldRetryOnError: false,
          dedupingInterval: 30_000,
        }}
      >
        <OfflineProvider>
          <UserProvider>{children}</UserProvider>
        </OfflineProvider>
      </SWRConfig>
    );
  }

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
        dedupingInterval: 30_000,
      }}
    >
      <OfflineProvider>
        <UserProvider>
          <BusinessProvider>
            <AuditProvider>
              <BranchProvider>
                <TransactionsProvider autoLoadSales={shouldHydrateSales}>
                  <ProductProvider>{children}</ProductProvider>
                </TransactionsProvider>
              </BranchProvider>
            </AuditProvider>
          </BusinessProvider>
        </UserProvider>
      </OfflineProvider>
    </SWRConfig>
  );
}
