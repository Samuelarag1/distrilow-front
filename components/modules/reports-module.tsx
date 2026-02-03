"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAudit } from "@/components/providers/audit-provider"
import { useTransactions } from "@/components/providers/transactions-provider"
import { useBusiness } from "@/components/providers/business-provider"
import {
    History,
    Users,
    Package,
    AlertCircle,
    CheckCircle2,
    Clock,
    DollarSign,
    User as UserIcon,
    ShieldCheck
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

export function ReportsModule() {
    const { events } = useAudit()
    const { sales } = useTransactions()
    const { businessType } = useBusiness()
    const [activeTab, setActiveTab] = useState("audit")

    // Filter sales by business type
    const currentSales = sales.filter(s => s.businessType === businessType)

    // Calculate sales by cashier
    const salesByCashier = currentSales.reduce((acc, sale) => {
        if (!acc[sale.userName]) {
            acc[sale.userName] = { total: 0, count: 0 }
        }
        acc[sale.userName].total += sale.amount
        acc[sale.userName].count += 1
        return acc
    }, {} as Record<string, { total: number, count: number }>)

    const auditIcons: Record<string, React.ReactNode> = {
        create: <CheckCircle2 className="h-4 w-4 text-green-500" />,
        update: <Clock className="h-4 w-4 text-blue-500" />,
        delete: <AlertCircle className="h-4 w-4 text-red-500" />,
        adjust_stock: <Package className="h-4 w-4 text-orange-500" />,
        login: <ShieldCheck className="h-4 w-4 text-purple-500" />,
        logout: <ShieldCheck className="h-4 w-4 text-gray-500" />,
        close_cashbox: <DollarSign className="h-4 w-4 text-emerald-500" />,
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent w-fit">
                    Reportes de Auditoría
                </h1>
                <p className="text-muted-foreground">
                    Visualiza la actividad del sistema, desempeño de cajeros y logs de seguridad.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-muted p-1 rounded-xl w-full sm:w-auto h-auto grid grid-cols-2 sm:flex sm:flex-row gap-1">
                    <TabsTrigger value="audit" className="rounded-lg py-2 px-6">
                        <History className="h-4 w-4 mr-2" />
                        Auditoría Sistema
                    </TabsTrigger>
                    <TabsTrigger value="cashiers" className="rounded-lg py-2 px-6">
                        <Users className="h-4 w-4 mr-2" />
                        Cajeros
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="audit" className="space-y-4">
                    <Card className="border-none shadow-xl bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-primary" />
                                Historial de Eventos
                            </CardTitle>
                            <CardDescription>
                                Registro detallado de acciones realizadas en el sistema.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px] pr-4">
                                <div className="space-y-4">
                                    {events.length === 0 ? (
                                        <div className="text-center py-10 text-muted-foreground">
                                            No hay eventos registrados aún.
                                        </div>
                                    ) : (
                                        events.map((event) => (
                                            <div key={event.id} className="flex items-start gap-4 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-all">
                                                <div className="mt-1 p-2 rounded-full bg-background border shadow-sm">
                                                    {auditIcons[event.action] || <History className="h-4 w-4" />}
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-sm">{event.description}</span>
                                                        <Badge variant="outline" className="text-[10px] font-mono">
                                                            {new Date(event.timestamp).toLocaleTimeString()}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <UserIcon className="h-3 w-3" />
                                                        <span className="font-medium text-foreground">{event.userName}</span>
                                                        <span>•</span>
                                                        <Badge variant="secondary" className="text-[9px] uppercase px-1 h-4">
                                                            {event.entityType}
                                                        </Badge>
                                                        <span>•</span>
                                                        <span>{new Date(event.timestamp).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cashiers" className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(salesByCashier).map(([name, data]) => (
                            <Card key={name} className="overflow-hidden border-t-4 border-t-primary shadow-lg">
                                <CardHeader className="pb-2">
                                    <Badge variant="outline" className="w-fit mb-2">Usuario Activo</Badge>
                                    <CardTitle className="text-2xl flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <UserIcon className="h-4 w-4 text-primary" />
                                        </div>
                                        {name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4 mt-2">
                                        <div className="flex items-center justify-between py-2 border-b border-dashed">
                                            <span className="text-muted-foreground text-sm font-medium">Total Vendido</span>
                                            <span className="text-xl font-black text-primary">
                                                ${data.total.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between py-2 border-b border-dashed">
                                            <span className="text-muted-foreground text-sm font-medium">Operaciones</span>
                                            <span className="font-bold">{data.count} ventas</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-muted-foreground text-sm font-medium">Ticket Promedio</span>
                                            <span className="font-bold">${(data.total / data.count).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {Object.keys(salesByCashier).length === 0 && (
                        <Card>
                            <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
                                No se registran ventas para el tipo de negocio actual.
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
