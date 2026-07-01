"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Without this, an uncaught render error
 * anywhere in a page (a widget that doesn't guard against `data` being
 * undefined during a session-expiry race, for example) unmounts the whole
 * page — sidebar, header and the "Cerrar sesion" button included, leaving
 * no way out. This file guarantees there is always a way out: retry, or
 * clear the session and go back to login.
 *
 * Deliberately styled with plain HTML/inline classes instead of the app's
 * shared UI components — this page's job is to survive when something else
 * already broke, so it should depend on as little shared code as possible.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route crashed:", error);
  }, [error]);

  const handleClearSession = () => {
    document.cookie
      .split(";")
      .forEach((cookie) => {
        const name = cookie.split("=")[0]?.trim();
        if (!name) return;
        document.cookie = `${name}=; Max-Age=0; path=/`;
      });
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/70 bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">
          Algo salio mal!
        </h1>
        <p className="text-sm text-muted-foreground">
          Puede ser un error temporal, o tu sesion puede haber vencido. Probá
          de nuevo, y si sigue pasando, cerrá sesion y volvé a entrar.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Reintentar
          </button>
          <button
            onClick={handleClearSession}
            className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cerrar sesion y volver a entrar
          </button>
        </div>
      </div>
    </div>
  );
}
