"use client"

import type React from "react"
import { createContext, useContext, useState } from "react"

type BusinessType = "restaurant" | "retail" | "services"

interface BusinessContextType {
  businessType: BusinessType
  setBusinessType: (type: BusinessType) => void
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined)

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [businessType, setBusinessType] = useState<BusinessType>("restaurant")

  return <BusinessContext.Provider value={{ businessType, setBusinessType }}>{children}</BusinessContext.Provider>
}

export function useBusiness() {
  const context = useContext(BusinessContext)
  if (context === undefined) {
    throw new Error("useBusiness must be used within a BusinessProvider")
  }
  return context
}
