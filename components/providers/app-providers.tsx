"use client"

import React from "react"
import { BusinessProvider } from "./business-provider"
import { TransactionsProvider } from "./transactions-provider"
import { ProductProvider } from "./product-provider"
import { UserProvider } from "./user-provider"
import { AuditProvider } from "./audit-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <BusinessProvider>
            <UserProvider>
                <AuditProvider>
                    <TransactionsProvider>
                        <ProductProvider>
                            {children}
                        </ProductProvider>
                    </TransactionsProvider>
                </AuditProvider>
            </UserProvider>
        </BusinessProvider>
    )
}
