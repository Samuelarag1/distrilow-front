"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/components/providers/user-provider";
import { setApiSession } from "@/lib/api-client";
import { backendApi } from "@/lib/backend-api";
import { isPosCashOnlyUser } from "@/lib/permissions";
import type { SessionBranch } from "@/lib/api-types";

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

      document.cookie = `token=${data.accessToken}; path=/`;
      document.cookie = `accessToken=${data.accessToken}; path=/`;
      document.cookie = `refreshToken=${data.refreshToken}; path=/`;
      document.cookie = `user=${encodeURIComponent(JSON.stringify(currentUser))}; path=/`;
      document.cookie = `branches=${encodeURIComponent(
        JSON.stringify(availableBranches)
      )}; path=/`;
      document.cookie = `activeBranchId=${activeBranchId ?? ""}; path=/`;
      document.cookie = `needsOnboarding=${needsOnboarding}; path=/`;

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
    <div className="relative min-h-screen overflow-hidden bg-[#070b1a] p-3 md:p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl orb-float-slow" />
        <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-blue-600/25 blur-3xl orb-float" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl orb-float-reverse" />
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-2xl backdrop-blur-sm md:min-h-[calc(100vh-3rem)] md:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-10 text-white md:flex md:flex-col md:justify-between">
          <div className="absolute inset-0 gradient-flow opacity-80" />
          <div className="absolute inset-0 grid-overlay opacity-25" />

          <div className="absolute -right-24 top-8 h-64 w-64 rounded-full border border-white/30 pulse-ring" />
          <div className="absolute left-6 top-24 h-72 w-72 rounded-full border border-white/20 pulse-ring-delayed" />
          <div className="absolute left-24 top-40 h-80 w-80 rounded-full border border-white/15 pulse-ring-slow" />

          <div className="relative z-10 animate-in-up">
            <Sparkles className="mb-8 h-12 w-12" />
            <h1 className="text-5xl font-black leading-tight tracking-tight">
              Hello
              <br />
              SaleSkip!
            </h1>
            <p className="mt-6 max-w-sm text-base text-white/90">
              Skip repetitive sales tasks. Get highly productive through automation and
              save tons of time.
            </p>
          </div>

          <p className="relative z-10 text-sm text-white/70">
            © 2026 SaleSkip. All rights reserved.
          </p>
        </section>

        <section className="relative flex items-center justify-center overflow-hidden px-6 py-10 sm:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_45%)]" />
          <div className="absolute inset-0 subtle-lines opacity-40" />

          <form onSubmit={handleLogin} className="relative z-10 w-full max-w-sm space-y-6 animate-in-up">
            <div className="space-y-5">
              <div>
                <p className="text-xl font-bold tracking-tight text-slate-900">SaleSkip</p>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">Welcome Back!</h2>
                <p className="text-sm text-slate-500">
                  Enter your credentials to continue.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-600">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-0 border-b border-slate-300 rounded-none px-0 shadow-none focus-visible:ring-0 focus-visible:border-slate-900"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-600">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-0 border-b border-slate-300 rounded-none px-0 shadow-none focus-visible:ring-0 focus-visible:border-slate-900"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Button
                className="h-11 w-full bg-slate-900 text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ingresando...
                  </span>
                ) : (
                  "Login Now"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-slate-300 text-slate-700"
                disabled
              >
                Login with Google
              </Button>
            </div>

            <p className="text-center text-xs text-slate-500">
              Forgot password <span className="font-semibold text-slate-700">Click here</span>
            </p>
          </form>
        </section>
      </div>

      <style jsx>{`
        .gradient-flow {
          background: linear-gradient(135deg, #2563eb, #1d4ed8, #4f46e5, #2563eb);
          background-size: 250% 250%;
          animation: gradientShift 12s ease infinite;
        }

        .grid-overlay {
          background-image: linear-gradient(
              rgba(255, 255, 255, 0.35) 1px,
              transparent 1px
            ),
            linear-gradient(90deg, rgba(255, 255, 255, 0.35) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(circle at center, black 15%, transparent 75%);
        }

        .subtle-lines {
          background-image: linear-gradient(
            to right,
            transparent,
            rgba(15, 23, 42, 0.08) 50%,
            transparent
          );
          background-size: 220% 100%;
          animation: shimmer 8s linear infinite;
        }

        .pulse-ring {
          animation: pulseScale 8s ease-in-out infinite;
        }

        .pulse-ring-delayed {
          animation: pulseScale 9s ease-in-out infinite 1s;
        }

        .pulse-ring-slow {
          animation: pulseScale 11s ease-in-out infinite 2s;
        }

        .orb-float {
          animation: float 9s ease-in-out infinite;
        }

        .orb-float-slow {
          animation: float 12s ease-in-out infinite;
        }

        .orb-float-reverse {
          animation: floatReverse 10s ease-in-out infinite;
        }

        .animate-in-up {
          animation: fadeInUp 0.7s ease-out both;
        }

        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes pulseScale {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.45;
          }
          50% {
            transform: scale(1.06);
            opacity: 0.75;
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-20px) translateX(12px);
          }
        }

        @keyframes floatReverse {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(16px) translateX(-14px);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 220% 50%;
          }
        }

        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(16px);
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
