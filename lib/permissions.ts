import type { UserRole } from "@/lib/api-types";

const MANAGEMENT_ROLES: UserRole[] = ["admin", "manager"];

export function isManagementRole(role?: UserRole | null) {
  return !!role && MANAGEMENT_ROLES.includes(role);
}

export function isBranchLockedUser(role?: UserRole | null, branchesCount = 0) {
  if (!role) return false;
  return !isManagementRole(role) && branchesCount <= 1;
}

export function canSwitchBranches(role?: UserRole | null, branchesCount = 0) {
  return branchesCount > 1;
}

export function isPosCashOnlyUser(role?: UserRole | null, branchesCount = 0) {
  return isBranchLockedUser(role, branchesCount);
}

export function canAccessExpenses(role?: UserRole | null, branchesCount = 0) {
  return !isPosCashOnlyUser(role, branchesCount);
}
