"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Search, Shield, User as UserIcon, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser, User } from "@/components/providers/user-provider";
import { api } from "@/lib/api-client";
import { useEffect } from "react";

export function UsersModule() {
    const { currentUser } = useUser();
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setIsLoading(true);
                const data = await api.get("/users");
                setUsers(data);
            } catch (error) {
                console.error("Failed to fetch users:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (currentUser?.role === "admin") {
            fetchUsers();
        }
    }, [currentUser]);

    if (currentUser?.role !== "admin") {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <Shield className="h-12 w-12 text-destructive mx-auto" />
                    <h2 className="text-2xl font-bold">Acceso Denegado</h2>
                    <p className="text-muted-foreground">Solo los administradores pueden gestionar usuarios.</p>
                </div>
            </div>
        );
    }

    const filteredUsers = users.filter((user) =>
        (user.name ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                        Gestión de Usuarios
                    </h1>
                    <p className="text-muted-foreground">
                        Administra los accesos y roles del personal
                    </p>
                </div>
                <Button className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Nuevo Usuario
                </Button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar usuarios por nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredUsers.map((user) => (
                    <Card key={user.id} className="overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-primary">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <UserIcon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{user.name ?? "Sin nombre"}</h3>
                                        <Badge variant="secondary" className="capitalize text-[10px] font-black tracking-widest">
                                            {user.role}
                                        </Badge>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
