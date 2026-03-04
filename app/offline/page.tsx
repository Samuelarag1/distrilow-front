export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold">Sin conexion</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No hay internet disponible en este momento. Cuando vuelvas a tener
          conexion, recarga para continuar.
        </p>
      </section>
    </main>
  );
}
