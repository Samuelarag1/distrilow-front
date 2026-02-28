"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Search,
  Shield,
  User as UserIcon,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useUser } from "@/components/providers/user-provider";
import { useBranches } from "@/components/providers/branch-provider";
import { backendApi } from "@/lib/backend-api";
import type { UserRole } from "@/lib/api-types";
import { useToast } from "@/hooks/use-toast";

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  branches: Array<{ id: string; name: string }>;
  defaultBranchId: string | null;
};

const ROLE_OPTIONS: UserRole[] = [
  "admin",
  "manager",
  "staff",
  "seller",
  "cashier",
  "viewer",
];

const EMPTY_FORM = {
  email: "",
  password: "",
  role: "staff" as UserRole,
  isActive: true,
  branchIds: [] as string[],
  defaultBranchId: "",
};

export function UsersModule() {
  const { currentUser } = useUser();
  const { branches } = useBranches();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = currentUser?.role === "admin" || currentUser?.role === "manager";

  const fetchUsers = useCallback(async () => {
    if (!canManage) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await backendApi.users.list();
      const normalized: UserRow[] = data.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: Boolean(user.isActive),
        branches: (user.branches ?? []).map((branch) => ({
          id: branch.id,
          name: branch.name,
        })),
        defaultBranchId: user.defaultBranchId ?? null,
      }));
      setUsers(normalized);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los usuarios.");
    } finally {
      setIsLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingUser(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: UserRow) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: "",
      role: user.role,
      isActive: user.isActive,
      branchIds: user.branches.map((branch) => branch.id),
      defaultBranchId: user.defaultBranchId ?? "",
    });
    setIsDialogOpen(true);
  };

  const toggleBranch = (branchId: string, checked: boolean) => {
    setForm((prev) => {
      const branchIds = checked
        ? Array.from(new Set([...prev.branchIds, branchId]))
        : prev.branchIds.filter((id) => id !== branchId);

      const defaultBranchId =
        prev.defaultBranchId && branchIds.includes(prev.defaultBranchId)
          ? prev.defaultBranchId
          : branchIds[0] ?? "";

      return {
        ...prev,
        branchIds,
        defaultBranchId,
      };
    });
  };

  const handleSave = async () => {
    if (!form.email.trim()) {
      toast({
        variant: "destructive",
        title: "Email requerido",
        description: "Debes ingresar un email.",
      });
      return;
    }

    if (!editingUser && form.password.trim().length < 6) {
      toast({
        variant: "destructive",
        title: "Password invalida",
        description: "La password debe tener al menos 6 caracteres.",
      });
      return;
    }

    setIsSaving(true);

    try {
      if (editingUser) {
        const updatePayload: {
          email?: string;
          role?: UserRole;
          isActive?: boolean;
          password?: string;
        } = {
          email: form.email.trim(),
          role: form.role,
          isActive: form.isActive,
        };

        if (form.password.trim().length >= 6) {
          updatePayload.password = form.password.trim();
        }

        await backendApi.users.update(editingUser.id, updatePayload);

        await backendApi.users.updateBranches(editingUser.id, {
          branchIds: form.branchIds,
          defaultBranchId: form.defaultBranchId || undefined,
          replace: true,
        });

        toast({
          title: "Usuario actualizado",
          description: "Los cambios fueron guardados correctamente.",
        });
      } else {
        const created = await backendApi.users.create({
          email: form.email.trim(),
          password: form.password.trim(),
          role: form.role,
          isActive: form.isActive,
        });

        await backendApi.users.updateBranches(created.id, {
          branchIds: form.branchIds,
          defaultBranchId: form.defaultBranchId || undefined,
          replace: true,
        });

        toast({
          title: "Usuario creado",
          description: "El usuario fue creado correctamente.",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      await fetchUsers();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: err?.message || "No se pudo guardar el usuario.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await backendApi.users.remove(deleteTarget.id);
      toast({
        title: "Usuario eliminado",
        description: "El usuario fue eliminado correctamente.",
      });
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: err?.message || "No se pudo eliminar el usuario.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const haystack = `${user.email} ${user.role}`.toLowerCase();
        return haystack.includes(searchQuery.toLowerCase());
      }),
    [users, searchQuery]
  );

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold">Acceso Denegado</h2>
          <p className="text-muted-foreground">
            Solo administradores y managers pueden gestionar usuarios.
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
            Gestion de Usuarios
          </h1>
          <p className="text-muted-foreground">
            Administra los accesos y roles del personal
          </p>
        </div>
        <Button
          className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all"
          onClick={openCreateDialog}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo Usuario
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

      {isLoading && (
        <div className="text-sm text-muted-foreground">Cargando usuarios...</div>
      )}

      {error && !isLoading && (
        <div className="text-sm text-destructive">{error}</div>
      )}

      {!isLoading && !error && filteredUsers.length === 0 && (
        <div className="text-sm text-muted-foreground">No hay usuarios para mostrar.</div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUsers.map((user) => (
          <Card
            key={user.id}
            className="overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-primary"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{user.email}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className="capitalize text-[10px] font-black tracking-widest"
                      >
                        {user.role}
                      </Badge>
                      <Badge
                        variant={user.isActive ? "default" : "outline"}
                        className="text-[10px] font-black tracking-widest"
                      >
                        {user.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(user)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteTarget(user)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Actualiza los datos y permisos del usuario."
                : "Completa los datos para crear un nuevo usuario."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="usuario@empresa.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-password">
                {editingUser ? "Password (opcional)" : "Password"}
              </Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Minimo 6 caracteres"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Rol</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, role: value as UserRole }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3 mt-6">
                <Label>Activo</Label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sucursales asignadas</Label>
              <div className="max-h-36 overflow-y-auto border rounded-md p-3 space-y-2">
                {branches.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay sucursales disponibles.
                  </p>
                )}
                {branches.map((branch) => {
                  const checked = form.branchIds.includes(branch.id);
                  return (
                    <div key={branch.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleBranch(branch.id, Boolean(value))
                        }
                      />
                      <span className="text-sm">{branch.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Sucursal por defecto</Label>
              <Select
                value={form.defaultBranchId || "none"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultBranchId: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin sucursal por defecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin sucursal por defecto</SelectItem>
                  {branches
                    .filter((branch) => form.branchIds.includes(branch.id))
                    .map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingUser ? "Guardar Cambios" : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Usuario</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara el usuario{" "}
              <strong>{deleteTarget?.email}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
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
