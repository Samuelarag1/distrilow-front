"use client";

import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function BranchSelector() {
  const { branchId, branches, switchBranch } = useUser();
  const { state, isMobile, toggleSidebar } = useSidebar();
  const { toast } = useToast();

  if (!branches?.length) return null;

  const onChange = async (id: string) => {
    try {
      await switchBranch(id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo cambiar sucursal",
        description: error?.message ?? "Intenta nuevamente.",
      });
    }
  };

  const selectedBranchName =
    branches.find((branch) => branch.id === branchId)?.name ?? "Sucursal";
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
            <Store className="h-4 w-4" />
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
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Store size={15} />
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
    </div>
  );
}
