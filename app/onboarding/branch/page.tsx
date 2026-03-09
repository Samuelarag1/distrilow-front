"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";
import { useUser } from "@/components/providers/user-provider";
import { setApiSession } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { backendApi } from "@/lib/backend-api";
import { setPersistentSessionCookie } from "@/lib/client-cookies";

type BranchPayload = {
  code: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  branchType: "STORE" | "WAREHOUSE";
};

export default function OnboardingBranchesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    token,
    currentUser,
    branchId,
    needsOnboarding,
    setBranches,
    setBranchId,
    setNeedsOnboarding,
  } = useUser();

  const [open, setOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<BranchPayload>({
    code: "SUC-001",
    name: "",
    address: "",
    phone: "",
    email: "",
    isActive: true,
    branchType: "STORE",
  });

  useEffect(() => {
    if (!token && !currentUser) router.replace("/login");
  }, [token, currentUser, router]);

  useEffect(() => {
    if (branchId) router.replace("/");
  }, [branchId, router]);

  const show = !!(token || currentUser) && !branchId;

  const handleCreateBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.address.trim() ||
      !formData.code.trim()
    ) {
      toast({
        variant: "destructive",
        title: "Faltan datos",
        description: "Nombre, codigo y direccion son obligatorios.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await backendApi.branches.bootstrap(formData);

      const createdBranchId =
        res?.session?.activeBranchId ?? res?.branch?.id ?? null;

      if (!createdBranchId) {
        throw new Error(
          "La API creo la sucursal pero no devolvio el id."
        );
      }

      const availableBranches = res.session.availableBranches;
      const activeBranchId = res.session.activeBranchId;

      setBranches(availableBranches);
      setBranchId(activeBranchId);
      setNeedsOnboarding(false);
      setApiSession({
        accessToken: token ?? undefined,
        branchId: activeBranchId,
      });

      setPersistentSessionCookie("branches", JSON.stringify(availableBranches));
      setPersistentSessionCookie("activeBranchId", createdBranchId);
      setPersistentSessionCookie("needsOnboarding", false);

      router.push("/");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "No se pudo crear la sucursal",
        description: err?.message ?? "Error inesperado",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-900">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Configurar sucursal inicial</CardTitle>
              <CardDescription>
                {needsOnboarding
                  ? "Para empezar, crea tu primera sucursal."
                  : "Crea una sucursal para comenzar."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Primera Sucursal</DialogTitle>
                <DialogDescription>
                  Esta sucursal quedara como activa y por defecto. Despues podras
                  crear mas.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateBootstrap} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Ej: Casa Central"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Codigo</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value })
                      }
                      placeholder="Ej: SUC-001"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Direccion</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Ej: Av. Siempreviva 742"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branchType">Tipo</Label>
                    <Select
                      value={formData.branchType}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          branchType: value as BranchPayload["branchType"],
                        })
                      }
                    >
                      <SelectTrigger id="branchType" className="w-full">
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STORE">Tienda</SelectItem>
                        <SelectItem value="WAREHOUSE">Almacen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="isActive">Activa</Label>
                    <div className="h-10 flex items-center">
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, isActive: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefono (opcional)</Label>
                    <Input
                      id="phone"
                      value={formData.phone ?? ""}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="Ej: 351xxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (opcional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email ?? ""}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="sucursal@empresa.com"
                    />
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Crear y continuar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
