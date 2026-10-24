"use client";

import useSWR from "swr";
import { useUser } from "@/components/providers/user-provider";
import { backendApi } from "@/lib/backend-api";

/**
 * The branches the signed-in user can see (all of them, for an admin), for
 * the screens that manage them: /branches and /users. It replaces a global
 * provider that fetched them on every page (doc 03, S7). The key includes the
 * user, so another login in the same tab never gets the previous user's list.
 */
export function useBranchList() {
  const { token, currentUser } = useUser();
  const key = token && currentUser ? ["/branches", currentUser.id] : null;
  const { data, error, isLoading, mutate } = useSWR(key, () =>
    backendApi.branches.list()
  );

  return { branches: data ?? [], error, isLoading, mutate };
}
