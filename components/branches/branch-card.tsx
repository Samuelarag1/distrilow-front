"use client";

import { Building2, Edit, Mail, MapPin, MoreHorizontal, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Branch } from "@/lib/api-types";
import { BRANCH_TYPE_LABELS } from "@/lib/branches/branch-form";

/** A branch in the Sucursales list; the actions menu only for whoever manages. */
export function BranchCard({
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
