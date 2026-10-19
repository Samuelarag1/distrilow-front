"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { useUser } from "@/components/providers/user-provider";
import { useToast } from "@/hooks/use-toast";
import { BrandMark } from "@/components/common/brand-mark";
import { countPendingPosCartItems } from "@/lib/pos-cart-storage";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";

export function BranchSelector() {
  const { branchId, branches, currentUser, switchBranch } = useUser();
  const { state, isMobile, toggleSidebar } = useSidebar();
  const { toast } = useToast();
  // A switch asked for while this branch has a sale in progress, waiting for
  // the user to confirm it.
  const [pendingSwitch, setPendingSwitch] = useState<{
    branchId: string;
    items: number;
  } | null>(null);

  if (!branches?.length) return null;

  const branchName = (id: string | null) =>
    branches.find((branch) => branch.id === id)?.name || "otra sucursal";

  const doSwitch = async (id: string) => {
    try {
      await switchBranch(id);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo cambiar sucursal",
        description: getUserFacingErrorMessage(
          error,
          "Intenta nuevamente en unos segundos."
        ),
      });
    }
  };

  const onChange = (id: string) => {
    if (id === branchId) return;

    // The unfinished sale stays saved in this branch (lib/pos-cart-storage.ts)
    // and comes back on return; the warning only makes leaving it deliberate.
    const items = countPendingPosCartItems(currentUser?.id, branchId);
    if (items > 0) {
      setPendingSwitch({ branchId: id, items });
      return;
    }

    void doSwitch(id);
  };

  const confirmSwitch = () => {
    if (!pendingSwitch) return;
    const target = pendingSwitch.branchId;
    setPendingSwitch(null);
    void doSwitch(target);
  };

  const selectedBranchName =
    branches.find((branch) => branch.id === branchId)?.name ?? "Sucursal";
  const pendingItemsLabel =
    pendingSwitch?.items === 1 ? "1 producto" : `${pendingSwitch?.items ?? 0} productos`;
  const isCollapsedDesktop = !isMobile && state === "collapsed";

  if (isCollapsedDesktop) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mx-auto h-9 w-9 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
            onClick={toggleSidebar}
          >
            <BrandMark className="h-5 w-5 rounded-md border-0 shadow-none" />
            <span className="sr-only">Expandir sidebar</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
          {selectedBranchName}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg">
        <BrandMark className="h-8 w-8 rounded-lg" />
      </div>

      <div className="min-w-0 flex-1">
        <Select value={branchId ?? ""} onValueChange={onChange}>
          <SelectTrigger className="h-auto border-0 p-0 text-left font-semibold shadow-none">
            <SelectValue placeholder="Seleccionar sucursal" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name || branch.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AlertDialog
        open={pendingSwitch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSwitch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar de sucursal?</AlertDialogTitle>
            <AlertDialogDescription>
              Tenes una venta en curso en {selectedBranchName} ({pendingItemsLabel}).
              Queda guardada y la recuperas cuando vuelvas a {selectedBranchName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitch}>
              Cambiar a {branchName(pendingSwitch?.branchId ?? null)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
