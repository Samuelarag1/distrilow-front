"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SWRConfig } from "swr";

import { BusinessProvider } from "./business-provider";
import { TransactionsProvider } from "./transactions-provider";
import { ProductProvider } from "./product-provider";
import { ActiveBranchBoundary, UserProvider } from "./user-provider";
import { AuditProvider } from "./audit-provider";
import { OfflineProvider } from "./offline-provider";
import { BranchProvider } from "./branch-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPosRoute = pathname === "/pos" || pathname.startsWith("/pos/");

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
          <UserProvider>
            <ActiveBranchBoundary>{children}</ActiveBranchBoundary>
          </UserProvider>
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
                <ActiveBranchBoundary>
                  <TransactionsProvider autoLoadSales={false}>
                    <ProductProvider>{children}</ProductProvider>
                  </TransactionsProvider>
                </ActiveBranchBoundary>
              </BranchProvider>
            </AuditProvider>
          </BusinessProvider>
        </UserProvider>
      </OfflineProvider>
    </SWRConfig>
  );
}
