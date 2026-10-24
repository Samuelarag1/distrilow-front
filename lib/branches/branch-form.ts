import type { Branch, BranchType, CreateBranchRequest } from "@/lib/api-types";

// The branch form (create, edit and onboarding), as plain functions. The
// request carries exactly the fields the backend accepts for create and edit
// alike: sending one it doesn't know made every edit fail with 400 (doc 03, S1).

export const BRANCH_TYPE_LABELS: Record<BranchType, string> = {
  STORE: "Tienda",
  WAREHOUSE: "Depósito",
};

export type BranchFormValues = {
  code: string;
  name: string;
  address: string;
  branchType: BranchType;
  phone: string;
  email: string;
};

export type BranchFormErrors = Partial<
  Record<"code" | "name" | "address" | "email", string>
>;

export const EMPTY_BRANCH_FORM: BranchFormValues = {
  code: "",
  name: "",
  address: "",
  branchType: "STORE",
  phone: "",
  email: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What the edit dialog opens with: every editable field, as stored. */
export function branchToFormValues(branch: Branch): BranchFormValues {
  return {
    code: branch.code ?? "",
    name: branch.name ?? "",
    address: branch.address ?? "",
    branchType: branch.branchType ?? "STORE",
    phone: branch.phone ?? "",
    email: branch.email ?? "",
  };
}

export function validateBranchForm(values: BranchFormValues): BranchFormErrors {
  const errors: BranchFormErrors = {};
  if (!values.code.trim()) errors.code = "Ingresá el código.";
  if (!values.name.trim()) errors.name = "Ingresá el nombre.";
  if (!values.address.trim()) errors.address = "Ingresá la dirección.";
  const email = values.email.trim();
  if (email && !EMAIL_PATTERN.test(email)) errors.email = "El email no es válido.";
  return errors;
}

/** Trimmed; an empty phone or email goes as null, which clears it. */
export function toBranchRequest(values: BranchFormValues): CreateBranchRequest {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    address: values.address.trim(),
    branchType: values.branchType,
    phone: values.phone.trim() || null,
    email: values.email.trim() || null,
  };
}
