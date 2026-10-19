"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/common/brand-mark";
import { BrandSpinnerScreen } from "@/components/common/brand-spinner";

/**
 * - checking: the page-load restore is asking the server.
 * - unavailable: the server didn't answer; the session is kept and retried.
 * - confirmed / ended: momentary, while the app renders or /login loads.
 */
export type SessionGateStatus = "checking" | "unavailable" | "confirmed" | "ended";

/**
 * Shown on protected routes while there is no confirmed session, instead of
 * rendering the app empty (hint user in the menu, every figure at $0).
 */
export function SessionGate({
  status,
  onRetry,
}: {
  status: SessionGateStatus;
  onRetry: () => void;
}) {
  // Same full-screen spinner as the login and app/loading.tsx, so reloading a
  // page shows one continuous spinner until the screen is ready.
  if (status !== "unavailable") {
    return <BrandSpinnerScreen label="Verificando tu sesion..." />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section
        role="status"
        aria-live="polite"
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card p-6 text-center shadow-sm"
      >
        <BrandMark className="h-14 w-14" />
        <WifiOff className="h-5 w-5 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">
            No pudimos conectar con el servidor
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu sesion sigue abierta. Volvemos a intentar automaticamente.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button className="h-11 w-full" onClick={onRetry}>
            Reintentar ahora
          </Button>
          <Button asChild variant="ghost" className="h-11 w-full">
            <Link href="/login">Ir al inicio de sesion</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
