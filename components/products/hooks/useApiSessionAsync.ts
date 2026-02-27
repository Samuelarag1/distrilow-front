// components/products/hooks/useApiSessionSync.ts
import { useEffect } from "react";
import { setApiSession } from "@/lib/api-client";

export function useApiSessionSync(
  token?: string | null,
  branchId?: string | null
) {
  useEffect(() => {
    if (token && branchId) {
      setApiSession(token, branchId);
    }
  }, [token, branchId]);
}
