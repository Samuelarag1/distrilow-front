"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/components/providers/user-provider";
import { BrandMark } from "@/components/common/brand-mark";

export function BranchSelector() {
  const { branchId, branches, switchBranch } = useUser();

  if (!branches?.length) return null;

  const onChange = (id: string) => {
    void switchBranch(id);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg">
        <BrandMark className="h-8 w-8" />
      </div>

      <div className="min-w-0 flex-1">
        <Select value={branchId ?? ""} onValueChange={onChange}>
          <SelectTrigger className="h-auto border-0 p-0 text-left font-semibold shadow-none">
            <SelectValue placeholder="Seleccionar sucursal" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
