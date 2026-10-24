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
import { selectBranch } from "@/lib/active-branch";
import { applySession } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BranchFormFields,
  focusFirstBranchError,
} from "@/components/branches/branch-form-fields";
import { backendApi } from "@/lib/backend-api";
import {
  EMPTY_BRANCH_FORM,
  toBranchRequest,
  validateBranchForm,
  type BranchFormErrors,
  type BranchFormValues,
} from "@/lib/branches/branch-form";

export default function OnboardingBranchesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { token, currentUser, branchId, needsOnboarding } = useUser();

  const [open, setOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<BranchFormValues>({
    ...EMPTY_BRANCH_FORM,
    code: "SUC-001",
  });
  const [errors, setErrors] = useState<BranchFormErrors>({});

  useEffect(() => {
    if (!token && !currentUser) router.replace("/login");
  }, [token, currentUser, router]);

  useEffect(() => {
    if (branchId) router.replace("/");
  }, [branchId, router]);

  const show = !!(token || currentUser) && !branchId;

  const handleCreateBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();

    const found = validateBranchForm(formData);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstBranchError("onboarding", found);
      return;
    }

    setIsSaving(true);
    try {
      const res = await backendApi.branches.bootstrap(toBranchRequest(formData));

      const createdBranchId =
        res?.session?.activeBranchId ?? res?.branch?.id ?? null;

      if (!createdBranchId) {
        throw new Error(
          "La API creo la sucursal pero no devolvio el id."
        );
      }

      applySession(
        { session: { ...res.session, needsOnboarding: false } },
        "onboarding"
      );
      selectBranch(createdBranchId);

      router.push("/");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No se pudo crear la sucursal",
        description: getUserFacingErrorMessage(
          err,
          "Revisá los datos de la sucursal y volvé a intentar."
        ),
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

              <form
                onSubmit={handleCreateBootstrap}
                noValidate
                className="space-y-4 pt-2"
              >
                <BranchFormFields
                  idPrefix="onboarding"
                  values={formData}
                  errors={errors}
                  onChange={(field, value) =>
                    setFormData((prev) => ({ ...prev, [field]: value }))
                  }
                />

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
