"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";
import { useUser } from "@/components/providers/user-provider";
import { setApiSession } from "@/lib/api-client";
import { backendApi } from "@/lib/backend-api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const {
    setCurrentUser,
    setToken,
    setBranchId,
    setBranches,
    setNeedsOnboarding,
  } = useUser();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = await backendApi.auth.login({
        email,
        password,
      });

      const currentUser = { ...data.user, name: data.user.email };

      setToken(data.accessToken);
      setCurrentUser(currentUser);

      const activeBranchId = data.session?.activeBranchId ?? null;
      const availableBranches = data.session?.availableBranches ?? [];
      const needsOnboarding = data.session?.needsOnboarding ?? false;

      setBranchId(activeBranchId);
      setBranches?.(availableBranches);
      setNeedsOnboarding?.(needsOnboarding);

      setApiSession({
        accessToken: data.accessToken,
        branchId: activeBranchId ?? undefined,
      });

      document.cookie = `token=${data.accessToken}; path=/`;
      document.cookie = `accessToken=${data.accessToken}; path=/`;
      document.cookie = `refreshToken=${data.refreshToken}; path=/`;
      document.cookie = `user=${encodeURIComponent(
        JSON.stringify(currentUser)
      )}; path=/`;
      document.cookie = `branches=${encodeURIComponent(
        JSON.stringify(availableBranches)
      )}; path=/`;
      document.cookie = `activeBranchId=${activeBranchId ?? ""}; path=/`;
      document.cookie = `needsOnboarding=${needsOnboarding}; path=/`;

      toast({
        title: "Inicio de sesion exitoso",
        description: `Bienvenido, ${data.user.email}`,
      });

      if (needsOnboarding || !activeBranchId) {
        router.push("/onboarding/branch");
      } else {
        router.push("/");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de autenticacion",
        description: error.message || "Credenciales invalidas",
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
          <CardTitle className="text-2xl font-bold text-center">
            Bienvenido
          </CardTitle>
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
