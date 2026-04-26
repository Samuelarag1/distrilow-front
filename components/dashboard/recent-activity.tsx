"use client";

import useSWR from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const statusColors = {
  completed: "bg-green-100 text-green-800",
};

type RecentSale = {
  id: string;
  amount: number;
  date: string;
};

export function RecentActivity() {
  const { branchId } = useUser();
  const {
    data: recentSales = [],
    error,
    isLoading,
  } = useSWR<RecentSale[]>(
    branchId ? ["dashboard-recent-sales", branchId] : null,
    async () => {
      const payload = await backendApi.sales.list(
        {
          limit: 5,
          status: "COMPLETED",
        },
        branchId
      );

      return payload.items.map((sale) => {
        if (typeof sale.totalAmount !== "number") {
          throw new Error("Invalid sales contract: totalAmount");
        }
        if (!sale.createdAt) {
          throw new Error("Invalid sales contract: createdAt");
        }

        return {
          id: String(sale.id),
          amount: sale.totalAmount,
          date: sale.createdAt,
        };
      });
    },
    {
      keepPreviousData: true,
    }
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Actividad Reciente</CardTitle>
        <CardDescription className="text-sm">
          Ultimas transacciones criticas del negocio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        {isLoading && recentSales.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              Cargando actividad reciente...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
            No se pudo cargar la actividad reciente.
          </div>
        )}

        {recentSales.map((sale) => (
          <div
            key={sale.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b pb-4 last:border-0 last:pb-0 sm:gap-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0 border">
                <AvatarFallback className="bg-primary/5 text-primary font-bold">
                  V{sale.id.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-none">
                  Venta #{sale.id.slice(0, 8)}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground first-letter:uppercase">
                  Venta realizada -{" "}
                  {formatDistanceToNow(new Date(sale.date), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge
                className={`text-[10px] font-black uppercase tracking-tighter ${statusColors.completed}`}
              >
                Completado
              </Badge>
              <div className="font-black text-primary">
                ${sale.amount.toLocaleString()}
              </div>
            </div>
          </div>
        ))}

        {!isLoading && recentSales.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground italic">
              No hay actividad reciente aun.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
