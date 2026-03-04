"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Activity, BarChart3, Boxes, Loader2, ShieldCheck, Store } from "lucide-react";
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

const systemHighlights: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Stock centralizado",
    description: "Controla inventario, compras y reposicion desde una sola vista.",
    icon: Boxes,
  },
  {
    title: "Ventas en vivo",
    description: "Monitorea caja, POS y rendimiento por sucursal en tiempo real.",
    icon: Activity,
  },
  {
    title: "Decision rapida",
    description: "Reportes claros para decidir precios, margenes y movimiento.",
    icon: BarChart3,
  },
];

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
  const { setCurrentUser, setToken, setBranchId, setBranches, setNeedsOnboarding } =
    useUser();

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

      setClientCookie("accessToken", data.accessToken);
      setClientCookie("user", JSON.stringify(currentUser));
      setClientCookie("branches", JSON.stringify(availableBranches));
      setClientCookie("activeBranchId", activeBranchId ?? "");
      setClientCookie("needsOnboarding", needsOnboarding);

      toast({
        title: "Inicio de sesion exitoso",
        description: `Bienvenido, ${data.user.email}`,
      });

      const posOnly = isPosCashOnlyUser(data.user.role, availableBranches.length);

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
    <div className="relative min-h-screen overflow-hidden bg-background p-4 text-foreground md:p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 login-ambient" />
        <div className="absolute inset-0 mesh-grid opacity-45" />
        <div className="absolute -left-24 top-10 h-80 w-80 rounded-full orb-a blur-3xl orb-float-slow" />
        <div className="absolute right-10 top-1/4 h-72 w-72 rounded-full orb-b blur-3xl orb-float" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full orb-c blur-3xl orb-float-reverse" />
      </div>

      <div className="login-frame mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-7xl overflow-hidden rounded-3xl border border-border/60 bg-card/80 backdrop-blur-md md:min-h-[calc(100vh-3rem)] md:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden overflow-hidden border-r border-border/60 p-10 text-card-foreground md:flex md:flex-col md:justify-between lg:p-14">
          <div className="absolute inset-0 left-panel-gradient" />
          <div className="absolute inset-0 scan-line opacity-40 animate-scan" />

          <div className="relative z-10 space-y-8">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-primary/80">
                  Plataforma oficial
                </p>
                <p className="text-lg font-semibold tracking-tight">DistriLow</p>
              </div>
            </div>

            <div className="space-y-4 animate-in-up">
              <h1 className="text-4xl font-bold leading-tight lg:text-5xl">
                Centro de operaciones para tu distribuidora.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground lg:text-lg">
                DistriLow conecta sucursales, inventario, ventas y reportes en una sola
                experiencia de gestion.
              </p>
            </div>

            <div className="grid gap-3">
              {systemHighlights.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-border/70 bg-background/50 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background/70"
                >
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Acceso para personal autorizado
          </p>
        </section>

        <section className="relative flex items-center justify-center px-5 py-8 sm:px-10">
          <div className="absolute inset-0 right-panel-gradient" />

          <form
            onSubmit={handleLogin}
            className="form-shell relative z-10 w-full max-w-md space-y-7 rounded-3xl border border-border/70 bg-background/80 p-7 backdrop-blur-xl sm:p-8"
          >
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Conexion cifrada
              </div>

              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                  Ingreso al sistema
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  Bienvenido a DistriLow
                </h2>
                <p className="text-sm text-muted-foreground">
                  Inicia sesion para administrar ventas, stock y sucursales.
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
                  className="h-12 border-input bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40"
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
                  className="h-12 border-input bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40"
                  required
                />
              </div>
            </div>

            <Button
              className="h-12 w-full bg-primary font-semibold text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validando acceso...
                </span>
              ) : (
                "Ingresar al panel"
              )}
            </Button>

            <div className="rounded-xl border border-border bg-muted/45 px-3 py-2 text-xs text-muted-foreground">
              <p className="inline-flex items-center gap-2">
                <Activity className="h-3.5 w-3.5" />
                Sesion monitoreada para trazabilidad y seguridad operativa.
              </p>
            </div>
          </form>
        </section>
      </div>

      <style jsx>{`
        .login-frame {
          box-shadow:
            0 35px 90px -55px hsl(var(--ring) / 0.55),
            0 10px 30px -20px hsl(var(--foreground) / 0.2);
        }

        .form-shell {
          box-shadow: 0 30px 80px -50px hsl(var(--ring) / 0.5);
        }

        .login-ambient {
          background:
            radial-gradient(circle at 12% 8%, hsl(var(--chart-2) / 0.22), transparent 36%),
            radial-gradient(circle at 88% 85%, hsl(var(--chart-1) / 0.2), transparent 34%),
            linear-gradient(
              145deg,
              hsl(var(--background)),
              hsl(var(--muted) / 0.45) 55%,
              hsl(var(--background))
            );
        }

        .mesh-grid {
          background-image:
            linear-gradient(hsl(var(--border) / 0.45) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border) / 0.45) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: radial-gradient(circle at center, black 14%, transparent 78%);
        }

        .left-panel-gradient {
          background: linear-gradient(
            165deg,
            hsl(var(--primary) / 0.14),
            hsl(var(--chart-2) / 0.12) 45%,
            hsl(var(--background) / 0.08)
          );
        }

        .right-panel-gradient {
          background:
            radial-gradient(circle at 15% 10%, hsl(var(--primary) / 0.14), transparent 40%),
            radial-gradient(circle at 95% 90%, hsl(var(--chart-2) / 0.12), transparent 32%);
        }

        .scan-line {
          background: linear-gradient(
            120deg,
            transparent 0%,
            hsl(var(--foreground) / 0.12) 50%,
            transparent 100%
          );
        }

        .orb-a {
          background: hsl(var(--chart-2) / 0.24);
        }

        .orb-b {
          background: hsl(var(--primary) / 0.2);
        }

        .orb-c {
          background: hsl(var(--chart-1) / 0.2);
        }

        .animate-scan {
          animation: scan 10s linear infinite;
        }

        .orb-float {
          animation: float 9s ease-in-out infinite;
        }

        .orb-float-slow {
          animation: float 13s ease-in-out infinite;
        }

        .orb-float-reverse {
          animation: floatReverse 11s ease-in-out infinite;
        }

        .animate-in-up {
          animation: fadeInUp 0.7s ease-out both;
        }

        @keyframes scan {
          0% {
            transform: translateX(-20%);
          }
          100% {
            transform: translateX(20%);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-14px) translateX(10px);
          }
        }

        @keyframes floatReverse {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(16px) translateX(-10px);
          }
        }

        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(14px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
