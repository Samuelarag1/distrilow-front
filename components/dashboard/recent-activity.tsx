"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
];

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function RecentActivity() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">
          Actividad Reciente
        </CardTitle>
        <CardDescription className="text-sm">
          Últimas transacciones y eventos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex flex-wrap items-center justify-between gap-2 sm:gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src="/placeholder.svg?height=36&width=36" />
                <AvatarFallback>
                  {activity.customer
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none truncate">
                  {activity.customer}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {activity.action} • {activity.time}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge
                className={`text-xs ${
                  statusColors[activity.status as keyof typeof statusColors]
                }`}
              >
                {activity.status}
              </Badge>
              <div className="font-medium">{activity.amount}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
