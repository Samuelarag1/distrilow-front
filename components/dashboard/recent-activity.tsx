"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

const activities = [
  {
    id: 1,
    type: "order",
    customer: "María García",
    action: "realizó un pedido",
    amount: "$45.50",
    time: "hace 5 min",
    status: "pending",
  },
  {
    id: 2,
    type: "reservation",
    customer: "Carlos López",
    action: "hizo una reserva",
    amount: "4 personas",
    time: "hace 15 min",
    status: "confirmed",
  },
  {
    id: 3,
    type: "payment",
    customer: "Ana Martín",
    action: "completó el pago",
    amount: "$78.20",
    time: "hace 30 min",
    status: "completed",
  },
  {
    id: 4,
    type: "order",
    customer: "Pedro Ruiz",
    action: "canceló un pedido",
    amount: "$23.10",
    time: "hace 1 hora",
    status: "cancelled",
  },
]

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
}

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad Reciente</CardTitle>
        <CardDescription>Últimas transacciones y eventos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-4">
              <Avatar className="h-9 w-9">
                <AvatarImage src="/placeholder.svg?height=36&width=36" />
                <AvatarFallback>
                  {activity.customer
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{activity.customer}</p>
                <p className="text-sm text-muted-foreground">
                  {activity.action} • {activity.time}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className={statusColors[activity.status as keyof typeof statusColors]}>{activity.status}</Badge>
                <div className="text-sm font-medium">{activity.amount}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
