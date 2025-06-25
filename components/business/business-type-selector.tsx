"use client"

import { Store, Utensils, Wrench } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useBusiness } from "@/components/providers/business-provider"

const businessTypes = {
  restaurant: { label: "Restaurante", icon: Utensils },
  retail: { label: "Tienda", icon: Store },
  services: { label: "Servicios", icon: Wrench },
}

export function BusinessTypeSelector() {
  const { businessType, setBusinessType } = useBusiness()
  const CurrentIcon = businessTypes[businessType].icon

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <CurrentIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <Select value={businessType} onValueChange={setBusinessType}>
          <SelectTrigger className="border-0 shadow-none p-0 h-auto font-semibold text-left">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(businessTypes).map(([key, { label, icon: Icon }]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
