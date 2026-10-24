"use client";

import {
  Edit,
  Loader2,
  MoreHorizontal,
  Power,
  Star,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/lib/api-types";
import { ROLE_LABELS } from "@/lib/users/user-form";

/** A user in the Usuarios list: role, state, branches and the actions menu. */
export function UserCard({
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
