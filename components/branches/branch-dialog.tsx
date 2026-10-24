"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { Branch } from "@/lib/api-types";
import {
  EMPTY_BRANCH_FORM,
  branchToFormValues,
  validateBranchForm,
  type BranchFormErrors,
  type BranchFormValues,
} from "@/lib/branches/branch-form";

interface BranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch | null;
  onSave: (values: BranchFormValues) => Promise<void>;
}

/**
 * Create or edit a branch, saved by the caller (onSave). Mount it with a new
 * `key` on every open.
 */
export function BranchDialog({ open, onOpenChange, branch, onSave }: BranchDialogProps) {
  // Mounted fresh on every open (see `key` in BranchesModule): editing starts
  // from every field the branch has today.
  const [values, setValues] = useState<BranchFormValues>(() =>
    branch ? branchToFormValues(branch) : EMPTY_BRANCH_FORM
  );
  const [errors, setErrors] = useState<BranchFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateBranchForm(values);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstBranchError("branch", found);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(values);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent
        ref={contentRef}
        className="sm:max-w-[480px]"
        onOpenAutoFocus={(event) => {
          // Editing: focus the dialog itself, not the first field. On a phone
          // focusing the name would open the keyboard over the form.
          if (!branch) return;
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{branch ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
          <DialogDescription>
            {branch
              ? "Modificá los datos de la sucursal."
              : "La sucursal nueva queda activa y lista para asignar a usuarios."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <BranchFormFields
            idPrefix="branch"
            values={values}
            errors={errors}
            onChange={set}
          />

          <DialogFooter sticky>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {branch ? "Guardar cambios" : "Crear sucursal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
