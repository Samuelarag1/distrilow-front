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

import { useTransactions } from "@/components/providers/transactions-provider";
import { useBusiness } from "@/components/providers/business-provider";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function RecentActivity() {
  const { sales } = useTransactions();
  const { businessType } = useBusiness();

  const filteredSales = sales
    .filter(s => s.businessType === businessType)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

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
        {filteredSales.map((sale) => (
          <div
            key={sale.id}
            className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 border-b pb-4 last:border-0 last:pb-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 shrink-0 border">
                <AvatarFallback className="bg-primary/5 text-primary font-bold">
                  {sale.customerName
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-none truncate">
                  {sale.customerName}
                </p>
                <p className="text-xs text-muted-foreground truncate first-letter:uppercase mt-1">
                  Venta realizada • {formatDistanceToNow(new Date(sale.date), { addSuffix: true, locale: es })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge
                className={`text-[10px] font-black uppercase tracking-tighter ${statusColors.completed}`}
              >
                Completado
              </Badge>
              <div className="font-black text-primary">${sale.amount.toLocaleString()}</div>
            </div>
          </div>
        ))}
        {filteredSales.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground italic">No hay actividad reciente aún.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
