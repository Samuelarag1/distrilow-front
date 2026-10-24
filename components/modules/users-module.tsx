"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Search, Shield, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandSpinner } from "@/components/common/brand-spinner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { UserCard } from "@/components/users/user-card";
import { UserDialog } from "@/components/users/user-dialog";
import { useUser } from "@/components/providers/user-provider";
import { useBranchList } from "@/hooks/use-branch-list";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";
import type { User } from "@/lib/api-types";
import { isManagementRole } from "@/lib/permissions";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import {
  ROLE_LABELS,
  toCreateUserRequest,
  toUpdateUserRequest,
  type UserFormValues,
} from "@/lib/users/user-form";

function byEmail(a: User, b: User) {
  return a.email.localeCompare(b.email);
}

export function UsersModule() {
  const { currentUser } = useUser();
  const canManage = isManagementRole(currentUser?.role);
  const { toast } = useToast();

  // Keyed by the signed-in user: another login in this tab never sees this list.
  const usersKey = canManage && currentUser ? ["/users", currentUser.id] : null;
  const {
    data: users = [],
    error,
    isLoading,
    mutate,
  } = useSWR(usersKey, () => backendApi.users.list());
  const { branches, isLoading: branchesLoading } = useBranchList();

  const [searchQuery, setSearchQuery] = useState("");
  // The dialog remounts on every open (key), so it always starts from the
  // user as they are now, not from a previous, cancelled edit.
  const [dialog, setDialog] = useState({ open: false, key: 0 });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      `${user.email} ${ROLE_LABELS[user.role] ?? user.role}`
        .toLowerCase()
        .includes(query)
    );
  }, [users, searchQuery]);

  const replaceUser = (saved: User) =>
    mutate(
      (list = []) =>
        [...list.filter((user) => user.id !== saved.id), saved].sort(byEmail),
      { revalidate: false }
    );

  const openDialog = (user: User | null) => {
    setEditingUser(user);
    setDialog((prev) => ({ open: true, key: prev.key + 1 }));
  };

  const handleSave = async (values: UserFormValues) => {
    try {
      // One request: the user and their branches are saved together.
      const saved = editingUser
        ? await backendApi.users.update(editingUser.id, toUpdateUserRequest(values))
        : await backendApi.users.create(toCreateUserRequest(values));
      await replaceUser(saved);
      toast({
        title: editingUser ? "Usuario actualizado" : "Usuario creado",
        description: editingUser
          ? "Los cambios se guardaron."
          : `${saved.email} ya puede iniciar sesión.`,
      });
      setDialog((prev) => ({ ...prev, open: false }));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No pudimos guardar el usuario",
        description: getUserFacingErrorMessage(
          err,
          "Revisá los datos e intentá nuevamente."
        ),
      });
    }
  };

  const handleToggleActive = async (user: User) => {
    setTogglingId(user.id);
    try {
      const saved = await backendApi.users.update(user.id, {
        isActive: !user.isActive,
      });
      await replaceUser(saved);
      toast({
        title: saved.isActive ? "Usuario activado" : "Usuario desactivado",
        description: saved.isActive
          ? `${saved.email} puede volver a iniciar sesión.`
          : `${saved.email} ya no puede iniciar sesión y sus sesiones se cerraron.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No pudimos cambiar el estado",
        description: getUserFacingErrorMessage(err, "Intentá nuevamente."),
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await backendApi.users.remove(deleteTarget.id);
      await mutate(
        (list = []) => list.filter((user) => user.id !== deleteTarget.id),
        { revalidate: false }
      );
      toast({
        title: "Usuario eliminado",
        description: `${deleteTarget.email} se eliminó.`,
      });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No pudimos eliminar el usuario",
        description: getUserFacingErrorMessage(
          err,
          "Intentá nuevamente en unos segundos."
        ),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold">Acceso denegado</h2>
          <p className="text-muted-foreground">
            Solo los administradores gestionan usuarios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Usuarios
          </h1>
          <p className="text-muted-foreground">
            Quién entra al sistema, con qué rol y en qué sucursales
          </p>
        </div>
        <Button
          className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all"
          onClick={() => openDialog(null)}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por email o rol..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Only while the list is really on its way (SWR's first load). A list
          already in the cache shows at once and refreshes in the background. */}
      {isLoading && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <BrandSpinner label="Cargando usuarios..." />
        </div>
      )}

      {error && !isLoading && (
        <div className="text-sm text-destructive">
          {getUserFacingErrorMessage(error, "No pudimos cargar los usuarios.")}
        </div>
      )}

      {!isLoading && !error && filteredUsers.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No hay usuarios para mostrar.
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUsers.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            isSelf={user.id === currentUser?.id}
            isToggling={togglingId === user.id}
            onEdit={() => openDialog(user)}
            onToggleActive={() => void handleToggleActive(user)}
            onDelete={() => setDeleteTarget(user)}
          />
        ))}
      </div>

      <UserDialog
        key={dialog.key}
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        user={editingUser}
        isSelf={!!editingUser && editingUser.id === currentUser?.id}
        branches={branches}
        branchesLoading={branchesLoading}
        onSave={handleSave}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title={<>¿Eliminar {deleteTarget?.email}?</>}
        description="Solo se puede eliminar un usuario que nunca operó (por ejemplo, un alta por error). Si ya inició sesión o tiene ventas, cajas o gastos, desactivalo: no va a poder entrar y se conserva su historial."
        isDeleting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
