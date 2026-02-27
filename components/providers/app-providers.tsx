
"use client"

import React from "react"
import { BusinessProvider } from "./business-provider"
import { TransactionsProvider } from "./transactions-provider"
import { ProductProvider } from "./product-provider"
import { UserProvider } from "./user-provider"
import { AuditProvider } from "./audit-provider"
import { OfflineProvider } from "./offline-provider"

import { BranchProvider } from "./branch-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <OfflineProvider>
            <UserProvider>
                <BusinessProvider>
                    <AuditProvider>
                        <BranchProvider>
                            <TransactionsProvider>
                                <ProductProvider>
                                    {children}
                                </ProductProvider>
                            </TransactionsProvider>
                        </BranchProvider>
                    </AuditProvider>
                </BusinessProvider>
            </UserProvider>
        </OfflineProvider>
    )
}
