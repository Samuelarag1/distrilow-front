"use client";

import { useMemo, useRef, useState } from "react";
import {
  Building2,
  Edit,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BrandSpinner } from "@/components/common/brand-spinner";
import {
  BranchFormFields,
  focusFirstBranchError,
} from "@/components/branches/branch-form-fields";
import { useUser } from "@/components/providers/user-provider";
import { useBranchList } from "@/hooks/use-branch-list";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";
import type { Branch } from "@/lib/api-types";
import { isManagementRole } from "@/lib/permissions";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import {
  BRANCH_TYPE_LABELS,
  EMPTY_BRANCH_FORM,
  branchToFormValues,
  toBranchRequest,
  validateBranchForm,
  type BranchFormErrors,
  type BranchFormValues,
} from "@/lib/branches/branch-form";

function byName(a: Branch, b: Branch) {
  return a.name.localeCompare(b.name);
}

export function BranchesModule() {
  const { currentUser } = useUser();
  const canManage = isManagementRole(currentUser?.role);
  const { branches, isLoading, error, mutate } = useBranchList();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  // The dialog remounts on every open (key), so it always starts from the
  // branch as it is now, not from a previous, cancelled edit.
  const [dialog, setDialog] = useState({ open: false, key: 0 });
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredBranches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return branches;
    return branches.filter((branch) =>
      [branch.name, branch.code, branch.address]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [branches, searchQuery]);

  const openDialog = (branch: Branch | null) => {
    setEditingBranch(branch);
    setDialog((prev) => ({ open: true, key: prev.key + 1 }));
  };

  const handleSave = async (values: BranchFormValues) => {
    const payload = toBranchRequest(values);
    try {
      if (editingBranch) {
        const updated = await backendApi.branches.update(editingBranch.id, payload);
        await mutate(
          (list = []) =>
            list.map((b) => (b.id === updated.id ? updated : b)).sort(byName),
          { revalidate: false }
        );
        toast({
          title: "Sucursal actualizada",
          description: "Los cambios se guardaron.",
        });
      } else {
        const created = await backendApi.branches.create(payload);
        await mutate((list = []) => [...list, created].sort(byName), {
          revalidate: false,
        });
        toast({
          title: "Sucursal creada",
          description: `${created.name} ya está disponible para asignar a usuarios.`,
        });
      }
      setDialog((prev) => ({ ...prev, open: false }));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No pudimos guardar la sucursal",
        description: getUserFacingErrorMessage(
          err,
          "Revisá los datos e intentá nuevamente."
        ),
      });
    }
  };

  const handleDelete = async () => {
    if (!branchToDelete) return;
    setIsDeleting(true);
    try {
      await backendApi.branches.remove(branchToDelete.id);
      await mutate(
        (list = []) => list.filter((b) => b.id !== branchToDelete.id),
        { revalidate: false }
      );
      toast({
        title: "Sucursal eliminada",
        description: `${branchToDelete.name} se eliminó.`,
      });
      setBranchToDelete(null);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No pudimos eliminar la sucursal",
        description: getUserFacingErrorMessage(
          err,
          "Intentá nuevamente en unos segundos."
        ),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Sucursales
          </h1>
          <p className="text-muted-foreground">
            Las ubicaciones físicas de tu negocio
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => openDialog(null)}
            className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva sucursal
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, código o dirección..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Only while the list is really on its way (SWR's first load). A list
            already in the cache shows at once and refreshes in the background. */}
        {isLoading && (
          <div className="col-span-full flex min-h-[40vh] items-center justify-center">
            <BrandSpinner label="Cargando sucursales..." />
          </div>
        )}
        {error && !isLoading && (
          <p className="text-sm text-destructive col-span-full">
            {getUserFacingErrorMessage(
              error,
              "No pudimos cargar las sucursales."
            )}
          </p>
        )}
        {!isLoading && !error && filteredBranches.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            No hay sucursales para mostrar.
          </p>
        )}
        {filteredBranches.map((branch) => (
          <BranchCard
            key={branch.id}
            branch={branch}
            canManage={canManage}
            onEdit={() => openDialog(branch)}
            onDelete={() => setBranchToDelete(branch)}
          />
        ))}
      </div>

      {canManage && (
        <BranchDialog
          key={dialog.key}
          open={dialog.open}
          onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
          branch={editingBranch}
          onSave={handleSave}
        />
      )}

      <AlertDialog
        open={!!branchToDelete}
        onOpenChange={(open) => !open && !isDeleting && setBranchToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {branchToDelete?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede eliminar una sucursal sin ventas, cajas ni stock
              registrados, y que no sea la única sucursal de ningún usuario.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Stay open until the request ends: a 409 is shown with the
                // dialog still there, and the spinner is visible meanwhile.
                event.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BranchCard({
  branch,
  canManage,
  onEdit,
  onDelete,
}: {
  branch: Branch;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-t-4 border-t-primary/20 hover:border-t-primary">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg font-bold" title={branch.name}>
              {branch.name}
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="font-mono text-[10px]">
                {branch.code}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {BRANCH_TYPE_LABELS[branch.branchType] ?? branch.branchType}
              </Badge>
              {!branch.isActive && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Inactiva
                </Badge>
              )}
            </div>
          </div>
        </div>
        {canManage && (
          // Not modal: its items open dialogs, and two modal layers at once can
          // leave the page without pointer events when the dialog closes.
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label={`Acciones de ${branch.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
          <span>{branch.address}</span>
        </div>
        {branch.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-primary/60" />
            <span>{branch.phone}</span>
          </div>
        )}
        {branch.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-primary/60" />
            <span className="truncate">{branch.email}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface BranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch | null;
  onSave: (values: BranchFormValues) => Promise<void>;
}

function BranchDialog({ open, onOpenChange, branch, onSave }: BranchDialogProps) {
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
