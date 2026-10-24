"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandSpinner } from "@/components/common/brand-spinner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { BranchCard } from "@/components/branches/branch-card";
import { BranchDialog } from "@/components/branches/branch-dialog";
import { useUser } from "@/components/providers/user-provider";
import { useBranchList } from "@/hooks/use-branch-list";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";
import type { Branch } from "@/lib/api-types";
import { isManagementRole } from "@/lib/permissions";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import { toBranchRequest, type BranchFormValues } from "@/lib/branches/branch-form";

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

      <ConfirmDeleteDialog
        open={!!branchToDelete}
        title={<>¿Eliminar {branchToDelete?.name}?</>}
        description="Solo se puede eliminar una sucursal sin ventas, cajas ni stock registrados, y que no sea la única sucursal de ningún usuario. Esta acción no se puede deshacer."
        isDeleting={isDeleting}
        onCancel={() => setBranchToDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
