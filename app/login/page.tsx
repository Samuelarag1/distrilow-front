"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/components/providers/user-provider";
import { setApiSession } from "@/lib/api-client";
import { backendApi } from "@/lib/backend-api";
import { setClientCookie } from "@/lib/client-cookies";
import { isPosCashOnlyUser } from "@/lib/permissions";
import type { SessionBranch } from "@/lib/api-types";
import { BrandMark } from "@/components/common/brand-mark";
import { BrandSpinner } from "@/components/common/brand-spinner";

function normalizeSessionBranches(input: unknown): SessionBranch[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((raw, index) => {
      if (typeof raw === "string") {
        const id = raw.trim();
        if (!id) return null;
        return { id, name: `Sucursal ${index + 1}` } satisfies SessionBranch;
      }

      if (!raw || typeof raw !== "object") return null;
      const value = raw as { id?: unknown; branchId?: unknown; name?: unknown };
      const id =
        (typeof value.id === "string" && value.id.trim()) ||
        (typeof value.branchId === "string" && value.branchId.trim()) ||
        "";
      if (!id) return null;

      return {
        id,
        name:
          typeof value.name === "string" && value.name.trim()
            ? value.name
            : `Sucursal ${index + 1}`,
      } satisfies SessionBranch;
    })
    .filter((branch): branch is SessionBranch => Boolean(branch));
}

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

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const data = await backendApi.auth.login({ email, password });

      const currentUser = { ...data.user, name: data.user.email };
      const activeBranchId = data.session?.activeBranchId ?? null;
      const availableBranches = normalizeSessionBranches(
        data.session?.availableBranches ?? []
      );
      const needsOnboarding = data.session?.needsOnboarding ?? false;

      setToken(data.accessToken);
      setCurrentUser(currentUser);
      setBranchId(activeBranchId);
      setBranches?.(availableBranches);
      setNeedsOnboarding?.(needsOnboarding);

      setApiSession({
        accessToken: data.accessToken,
        branchId: activeBranchId ?? undefined,
      });

      setClientCookie("branches", JSON.stringify(availableBranches));
      setClientCookie("activeBranchId", activeBranchId ?? "");
      setClientCookie("needsOnboarding", needsOnboarding);

      toast({
        title: "Inicio de sesion exitoso",
        description: `Bienvenido, ${data.user.email}`,
      });

      const posOnly = isPosCashOnlyUser(
        data.user.role,
        availableBranches.length
      );

      if (needsOnboarding || !activeBranchId) {
        router.push("/onboarding/branch");
      } else if (posOnly) {
        router.push("/pos");
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-0 login-subtle-ambient" />

      <form
        onSubmit={handleLogin}
        className="relative w-full max-w-md space-y-6 rounded-2xl border border-border/70 bg-card/95 p-6 shadow-sm backdrop-blur-sm sm:p-8"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark className="h-16 w-16 ring-border/80" priority />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Iniciar sesion
            </h1>
            <p className="text-sm text-muted-foreground">
              Accede con tus credenciales para continuar.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground/90">
              Correo
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="equipo@distrilow.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 border-input bg-background/90 text-foreground placeholder:text-muted-foreground"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground/90">
              Contrasena
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 border-input bg-background/90 text-foreground placeholder:text-muted-foreground"
              required
            />
          </div>
        </div>

        <Button
          className="h-12 w-full font-semibold"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <BrandSpinner
              size="sm"
              label="Validando acceso..."
              layout="inline"
              labelClassName="text-primary-foreground"
            />
          ) : (
            "Ingresar"
          )}
        </Button>

        <div className="inline-flex w-full items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Conexion cifrada</span>
        </div>
      </form>

      <style jsx>{`
        .login-subtle-ambient {
          background: radial-gradient(
              circle at 15% 12%,
              hsl(var(--brand-cyan) / 0.09),
              transparent 38%
            ),
            radial-gradient(
              circle at 86% 90%,
              hsl(var(--brand-pink) / 0.05),
              transparent 40%
            );
        }
      `}</style>
    </div>
  );
}
