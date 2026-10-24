"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SWRConfig } from "swr";

import { BusinessProvider } from "./business-provider";
import { TransactionsProvider } from "./transactions-provider";
import { ProductProvider } from "./product-provider";
import { ActiveBranchBoundary, UserProvider } from "./user-provider";
import { OfflineProvider } from "./offline-provider";

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
            <ActiveBranchBoundary>
              <TransactionsProvider autoLoadSales={false}>
                <ProductProvider>{children}</ProductProvider>
              </TransactionsProvider>
            </ActiveBranchBoundary>
          </BusinessProvider>
        </UserProvider>
      </OfflineProvider>
    </SWRConfig>
  );
}
