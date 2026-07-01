"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown by the ROOT layout itself (where app/error.tsx
 * can't help, since it renders inside that same layout). Must render its
 * own <html>/<body> — this replaces literally everything else on the page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout crashed:", error);
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
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            background: "#f8f8f8",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
              padding: "1.5rem",
              borderRadius: "1rem",
              border: "1px solid #e5e5e5",
              background: "#fff",
            }}
          >
            <h1 style={{ fontSize: "1.1rem", fontWeight: 600 }}>
              La aplicacion no pudo cargar
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#555" }}>
              Probá de nuevo, y si sigue pasando, cerrá sesion y volvé a
              entrar.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginTop: "0.75rem",
              }}
            >
              <button
                onClick={() => reset()}
                style={{
                  height: 44,
                  borderRadius: 8,
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Reintentar
              </button>
              <button
                onClick={handleClearSession}
                style={{
                  height: 44,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  background: "#fff",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Cerrar sesion y volver a entrar
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
