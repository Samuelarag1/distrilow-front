"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  Edit,
  Loader2,
  MoreHorizontal,
  Power,
  Search,
  Shield,
  Star,
  Trash2,
  User as UserIcon,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandSpinner } from "@/components/common/brand-spinner";
import { FormField, focusFirstError } from "@/components/common/form-field";
import { useUser } from "@/components/providers/user-provider";
import { useBranchList } from "@/hooks/use-branch-list";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";
import type { Branch, User, UserRole } from "@/lib/api-types";
import { isManagementRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import {
  ASSIGNABLE_ROLES,
  EMPTY_USER_FORM,
  PASSWORD_HINT,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  hasErrors,
  toCreateUserRequest,
  toUpdateUserRequest,
  toggleBranch,
  userToFormValues,
  validateUserForm,
  type UserFormErrors,
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleteTarget?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede eliminar un usuario que nunca operó (por ejemplo, un
              alta por error). Si ya inició sesión o tiene ventas, cajas o
              gastos, desactivalo: no va a poder entrar y se conserva su
              historial.
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

function UserCard({
  user,
  isSelf,
  isToggling,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  user: User;
  isSelf: boolean;
  isToggling: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={`overflow-hidden group hover:shadow-lg transition-all border-l-4 ${
        user.isActive ? "border-l-primary" : "border-l-muted opacity-70"
      }`}
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-4">
            <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-bold text-lg" title={user.email}>
                {user.email}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
                {!user.isActive && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Inactivo
                  </Badge>
                )}
                {isSelf && (
                  <Badge variant="outline" className="text-[10px]">
                    Tu cuenta
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {/* Not modal: its items open dialogs, and two modal layers at once can
              leave the page without pointer events when the dialog closes. */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={isToggling}
                aria-label={`Acciones de ${user.email}`}
              >
                {isToggling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              {/* Your own account can't be deactivated or deleted (GES-05). */}
              {!isSelf && (
                <>
                  <DropdownMenuItem onClick={onToggleActive}>
                    <Power className="mr-2 h-4 w-4" />
                    {user.isActive ? "Desactivar" : "Activar"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {user.branches.length === 0 ? (
            <span className="text-xs text-destructive">
              Sin sucursales: no puede operar. Editalo para asignarle una.
            </span>
          ) : (
            user.branches.map((branch) => {
              const isDefault = branch.id === user.defaultBranchId;
              return (
                <Badge
                  key={branch.id}
                  variant={isDefault ? "default" : "outline"}
                  className="text-[11px] font-normal"
                  title={isDefault ? "Sucursal por defecto" : undefined}
                >
                  {isDefault && <Star className="mr-1 h-3 w-3" />}
                  {branch.name}
                </Badge>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  isSelf: boolean;
  branches: Branch[];
  branchesLoading: boolean;
  onSave: (values: UserFormValues) => Promise<void>;
}

function UserDialog({
  open,
  onOpenChange,
  user,
  isSelf,
  branches,
  branchesLoading,
  onSave,
}: UserDialogProps) {
  const mode = user ? "edit" : "create";
  // Mounted fresh on every open (see `key` in UsersModule): editing starts
  // from everything the user has today, branches and default included.
  const [values, setValues] = useState<UserFormValues>(() =>
    user ? userToFormValues(user) : EMPTY_USER_FORM
  );
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // Active branches can be assigned; an inactive one only shows if the user
  // already has it, and can be removed but not added back.
  const assignable = branches.filter(
    (branch) => branch.isActive || values.branchIds.includes(branch.id)
  );
  const selectedBranches = branches.filter((branch) =>
    values.branchIds.includes(branch.id)
  );
  // A legacy role (staff) stays visible while editing a user who has it.
  const roleOptions: UserRole[] =
    values.role && !ASSIGNABLE_ROLES.includes(values.role)
      ? [...ASSIGNABLE_ROLES, values.role]
      : [...ASSIGNABLE_ROLES];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateUserForm(values, mode);
    setErrors(found);
    if (hasErrors(found)) {
      focusFirstError([
        ["user-email", found.email],
        ["user-password", found.password],
        ["user-role", found.role],
        ["user-branches", found.branchIds],
      ]);
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
        className="sm:max-w-[560px]"
        onOpenAutoFocus={(event) => {
          // Editing: focus the dialog itself, not the first field. On a phone
          // focusing the email would open the keyboard over the form.
          if (!user) return;
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{user ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Modificá sus datos, su rol o sus sucursales."
              : "Completá los datos para darle acceso al sistema."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField id="user-email" label="Email" error={errors.email}>
            <Input
              id="user-email"
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="usuario@empresa.com"
              autoFocus={!user}
            />
          </FormField>

          <FormField
            id="user-password"
            label={user ? "Nueva contraseña (opcional)" : "Contraseña"}
            error={errors.password}
            hint={
              errors.password
                ? undefined
                : user
                  ? `Dejala vacía para no cambiarla. ${PASSWORD_HINT}`
                  : PASSWORD_HINT
            }
          >
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="user-role"
              label="Rol"
              error={errors.role}
              hint={
                isSelf
                  ? "No podés cambiar tu propio rol."
                  : values.role
                    ? ROLE_DESCRIPTIONS[values.role]
                    : undefined
              }
            >
              <Select
                value={values.role}
                onValueChange={(value) => set("role", value as UserRole)}
                disabled={isSelf}
              >
                <SelectTrigger
                  id="user-role"
                  aria-invalid={errors.role ? true : undefined}
                  aria-describedby="user-role-message"
                >
                  <SelectValue placeholder="Elegí un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              id="user-active"
              label="Estado"
              hint={
                isSelf
                  ? "No podés desactivar tu propia cuenta."
                  : values.isActive
                    ? "Puede iniciar sesión."
                    : "No puede entrar y se cierran sus sesiones."
              }
            >
              {/* The whole row toggles the switch: a bigger target than the switch alone. */}
              <label
                htmlFor="user-active"
                className={cn(
                  "flex h-10 items-center justify-between rounded-md border px-3",
                  isSelf ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                )}
              >
                <span className="text-sm">
                  {values.isActive ? "Activo" : "Inactivo"}
                </span>
                <Switch
                  id="user-active"
                  checked={values.isActive}
                  disabled={isSelf}
                  onCheckedChange={(checked) => set("isActive", checked)}
                />
              </label>
            </FormField>
          </div>

          <FormField id="user-branches" label="Sucursales" error={errors.branchIds}>
            <div
              id="user-branches"
              role="group"
              aria-label="Sucursales"
              className="grid gap-2 sm:grid-cols-2"
            >
              {branchesLoading && (
                <BrandSpinner
                  size="sm"
                  layout="inline"
                  label="Cargando sucursales..."
                  className="col-span-full justify-start py-2"
                />
              )}
              {!branchesLoading && assignable.length === 0 && (
                <p className="col-span-full text-xs text-muted-foreground">
                  No hay sucursales activas. Creá una en Sucursales.
                </p>
              )}
              {assignable.map((branch) => {
                const checked = values.branchIds.includes(branch.id);
                const disabled = !branch.isActive && !checked;
                const isDefault = checked && branch.id === values.defaultBranchId;
                const checkboxId = `user-branch-${branch.id}`;
                return (
                  // Each branch is a tile and the whole tile is the touch target.
                  <label
                    key={branch.id}
                    htmlFor={checkboxId}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                      checked
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/60",
                      disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    )}
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      disabled={disabled}
                      className="h-5 w-5"
                      onCheckedChange={(value) =>
                        setValues((prev) =>
                          toggleBranch(prev, branch.id, value === true)
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {branch.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {branch.code}
                        {!branch.isActive && " · inactiva"}
                      </span>
                    </span>
                    {isDefault && (
                      <Badge className="shrink-0 gap-1 px-2 text-[10px] font-medium">
                        <Star className="h-3 w-3" />
                        Por defecto
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </FormField>

          <FormField
            id="user-default-branch"
            label="Sucursal por defecto"
            hint="Donde empieza a trabajar al iniciar sesión."
          >
            <Select
              value={values.defaultBranchId}
              onValueChange={(value) => set("defaultBranchId", value)}
              disabled={selectedBranches.length === 0}
            >
              <SelectTrigger id="user-default-branch">
                <SelectValue placeholder="Primero elegí sus sucursales" />
              </SelectTrigger>
              <SelectContent>
                {selectedBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

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
              {user ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
