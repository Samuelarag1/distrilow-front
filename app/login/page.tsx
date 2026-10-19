"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";
import { isPosCashOnlyUser } from "@/lib/permissions";
import { applySession } from "@/lib/session";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import { BrandMark } from "@/components/common/brand-mark";
import { BrandSpinnerScreen } from "@/components/common/brand-spinner";

// false during SSR and until React hydrates the page, true afterwards.
const noopSubscribe = () => () => {};
function useIsHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export default function LoginPage() {
  // validating: waiting for the backend. entering: accepted, navigating — the
  // label matches app/loading.tsx so the hand-off reads as one spinner.
  const [status, setStatus] = useState<"idle" | "validating" | "entering">("idle");
  const isLoading = status !== "idle";
  const router = useRouter();
  const { toast } = useToast();
  const isHydrated = useIsHydrated();
  const { currentUser, token, branchId, branches, needsOnboarding } = useUser();

  // Single place that leaves /login: as soon as there is a session — from the
  // form below, or restored on page load from the httpOnly refresh cookie —
  // go where this user belongs instead of asking for credentials again.
  // replace(), so "back" doesn't return to the login form.
  useEffect(() => {
    if (!token || !currentUser) return;

    if (needsOnboarding || !branchId) {
      router.replace("/onboarding/branch");
    } else if (isPosCashOnlyUser(currentUser.role, branches.length)) {
      router.replace("/pos");
    } else {
      router.replace("/");
    }
  }, [token, currentUser, branchId, branches.length, needsOnboarding, router]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Uncontrolled inputs, read on submit: whatever the user (or the browser's
    // autofill) typed before hydration survives — controlled inputs would be
    // reset to their empty initial state when React hydrates.
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setStatus("validating");

    try {
      const data = await backendApi.auth.login({ email, password });

      // Token, user, branches and routing hints in one write. The active
      // branch is the last one this user opened in this browser (D7), else the
      // server's default — never one picked by the front.
      applySession(
        {
          ...data,
          session: {
            ...data.session,
            needsOnboarding: data.session?.needsOnboarding ?? false,
          },
        },
        "login"
      );
      setStatus("entering");

      toast({
        title: "Sesion iniciada",
        description: `Entraste correctamente como ${data.user.email}.`,
      });
      // Navigation happens in the effect above once the session state lands.
    } catch (error: any) {
      // Solo se apaga el loader en error: en exito se mantiene visible hasta
      // que la navegacion desmonta la pagina, para que el formulario no
      // reaparezca un instante antes de redirigir.
      setStatus("idle");
      toast({
        variant: "destructive",
        title: "No pudimos iniciar sesion",
        description: getUserFacingErrorMessage(
          error,
          "Revisa tu email y tu contrasena, y vuelve a intentarlo."
        ),
      });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-0 login-subtle-ambient" />

      {/* method="post" is only a safety net: if a native submit ever slipped
          through, credentials would never end up in the URL or history. */}
      <form
        method="post"
        onSubmit={handleLogin}
        aria-busy={isLoading}
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
              name="email"
              autoComplete="username"
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
              name="password"
              autoComplete="current-password"
              className="h-12 border-input bg-background/90 text-foreground placeholder:text-muted-foreground"
              required
            />
          </div>
        </div>

        {/* Disabled until hydration: before React takes over, a click or Enter
            would trigger the browser's native GET submit — a full reload that
            wipes the fields. A disabled default button also blocks Enter. */}
        <Button
          className="h-12 w-full font-semibold"
          type="submit"
          disabled={isLoading || !isHydrated}
        >
          Ingresar
        </Button>

        <div className="inline-flex w-full items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Conexion cifrada</span>
        </div>

      </form>

      {/* Outside the form on purpose: its backdrop-blur would trap a fixed
          overlay inside the card instead of covering the screen. */}
      {isLoading ? (
        <BrandSpinnerScreen
          label={status === "entering" ? "Cargando..." : "Validando acceso..."}
        />
      ) : null}

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
