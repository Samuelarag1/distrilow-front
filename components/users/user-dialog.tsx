"use client";

import { useRef, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandSpinner } from "@/components/common/brand-spinner";
import { FormField, focusFirstError } from "@/components/common/form-field";
import type { Branch, User, UserRole } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import {
  ASSIGNABLE_ROLES,
  EMPTY_USER_FORM,
  PASSWORD_HINT,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  hasErrors,
  toggleBranch,
  userToFormValues,
  validateUserForm,
  type UserFormErrors,
  type UserFormValues,
} from "@/lib/users/user-form";

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  isSelf: boolean;
  branches: Branch[];
  branchesLoading: boolean;
  onSave: (values: UserFormValues) => Promise<void>;
}

/**
 * Create or edit a user: data, role, state and branches, saved in one
 * request by the caller (onSave). Mount it with a new `key` on every open.
 */
export function UserDialog({
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
