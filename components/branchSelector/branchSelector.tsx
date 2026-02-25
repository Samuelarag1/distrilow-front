"use client";

import { Store } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/components/providers/user-provider";
import { setApiSession } from "@/lib/api-client";

export function BranchSelector() {
  const { token, branchId, branches, setBranchId } = useUser();

  if (!branches?.length) return null;

  const onChange = (id: string) => {
    setBranchId(id);
    if (token) setApiSession(token, id); // ✅ actualiza X-Branch-Id
    document.cookie = `activeBranchId=${id}; path=/`;
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Store size={15} />
      </div>

      <div className="flex-1 min-w-0">
        <Select value={branchId ?? ""} onValueChange={onChange}>
          <SelectTrigger className="border-0 shadow-none p-0 h-auto font-semibold text-left">
            <SelectValue placeholder="Seleccionar sucursal" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
