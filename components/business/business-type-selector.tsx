"use client"

import { Store } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useBusiness } from "@/components/providers/business-provider"

const businessTypes = {
  retail: { label: "Distribuidora Minorista"},
  wholesale: { label: "Distribuidora Mayorista"},
}

export function BusinessTypeSelector() {
  const { businessType, setBusinessType } = useBusiness() 

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"> 
        <Store size={15}/>
      </div>
      <div className="flex-1 min-w-0">
        <Select value={businessType} onValueChange={setBusinessType}>
          <SelectTrigger className="border-0 shadow-none p-0 h-auto font-semibold text-left">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(businessTypes).map(([key, { label}]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2"> 
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
