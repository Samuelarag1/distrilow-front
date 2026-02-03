"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { useProducts } from "@/components/providers/product-provider";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export function StockReport() {
    const { products } = useProducts();

    const totalValue = products.reduce((acc, item) => acc + (item.stock * item.price), 0);
    const lowStockItems = products.filter(item => item.stock <= (item.minStock || 0));

    const stockByCategory = products.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + item.stock;
        return acc;
    }, {} as Record<string, number>);

    const pieData = Object.keys(stockByCategory).map(key => ({
        name: key,
        value: stockByCategory[key]
    }));

    const chartData = products.map(p => ({
        name: p.name,
        stock: p.stock,
        min: p.minStock || 0
    }));

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Valor del Inventario</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Items Stock Bajo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{lowStockItems.length}</div>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Niveles de Stock por Producto</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickCount={6} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="stock" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Unidades" barSize={30} />
                                <Legend />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Composición por Categoría</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Alertas de Reposición</CardTitle>
                    <CardDescription>Productos que requieren atención inmediata</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {lowStockItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">{item.category}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-sm text-red-500 font-bold">
                                        {item.stock} / {item.minStock || 0} (Min)
                                    </div>
                                    <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-500"
                                            style={{ width: `${(item.stock / (item.minStock || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {lowStockItems.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">Todo el stock está en niveles óptimos.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
