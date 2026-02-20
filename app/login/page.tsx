"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";
import { useUser } from "@/components/providers/user-provider";
import { api } from "@/lib/api-client";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();
    const { setCurrentUser, setToken, setBranchId } = useUser();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const data = await api.post("/auth/login", { email, password });

            // data should contain { token: string, user: User }
            // Guardar JWT, datos de usuario y branchId en cookies
            document.cookie = `token=${data.token}; path=/; max-age=86400; SameSite=Strict`;
            document.cookie = `user=${JSON.stringify(data.user)}; path=/; max-age=86400; SameSite=Strict`;
            if (data.branchId) {
                document.cookie = `branchId=${data.branchId}; path=/; max-age=86400; SameSite=Strict`;
            }

            setCurrentUser(data.user);
            setToken(data.token);
            if (data.branchId) {
                setBranchId(data.branchId);
            }

            toast({
                title: "Inicio de sesión exitoso",
                description: `Bienvenido, ${data.user.name}.`,
            });
            router.push("/");
        } catch (error: any) {
            console.error("Login error:", error);
            toast({
                variant: "destructive",
                title: "Error de autenticación",
                description: error.message || "Credenciales inválidas. Intente nuevamente.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <div className="rounded-full bg-primary/10 p-3">
                            <Lock className="h-6 w-6 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">Bienvenido</CardTitle>
                    <CardDescription className="text-center">
                        Ingrese sus credenciales para acceder al sistema
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Usuario</Label>
                            <Input
                                id="email"
                                type="text"
                                placeholder="admin"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" type="submit" disabled={isLoading}>
                            {isLoading ? "Ingresando..." : "Ingresar"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
