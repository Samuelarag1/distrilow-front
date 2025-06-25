"use client"

import { MetricsCards } from "./metrics-cards"
import { SalesChart } from "./sales-chart"
import { RecentActivity } from "./recent-activity"
import { QuickActions } from "./quick-actions"

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de tu negocio</p>
        </div>
      </div>

      <MetricsCards />

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <SalesChart />
        </div>
        <div className="lg:col-span-3">
          <RecentActivity />
        </div>
      </div>

      <QuickActions />
    </div>
  )
}
