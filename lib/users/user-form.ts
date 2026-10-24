import type {
  CreateUserRequest,
  UpdateUserRequest,
  User,
  UserRole,
} from "@/lib/api-types";

// The users form, as plain functions: what it shows when it opens, what it
// accepts and what it sends. The backend is the authority on every rule; the
// form checks the same ones first so the admin sees the problem in the field
// instead of a generic error (doc 03, U7/U8).

/** The roles the screen offers: the ones that can operate (doc 03, D19). */
export const ASSIGNABLE_ROLES: readonly UserRole[] = ["admin", "cashier", "seller"];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  cashier: "Cajero",
  seller: "Vendedor",
  staff: "Sin permisos (staff)",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Todo el sistema: ventas, inventario, reportes, usuarios y sucursales.",
  cashier: "Punto de venta y caja de sus sucursales.",
  seller: "Punto de venta y caja de sus sucursales.",
  staff: "No puede usar ninguna pantalla. Asignale otro rol.",
};

/** Same rule as the backend's CreateUserDto. */
export const PASSWORD_HINT = "Mínimo 8 caracteres, con al menos una letra y un número.";

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UserFormValues = {
  email: string;
  /** Empty on edit means "keep the current one". Never trimmed: it is sent as typed, like the login does. */
  password: string;
  role: UserRole | "";
  isActive: boolean;
  branchIds: string[];
  defaultBranchId: string;
};

export type UserFormErrors = Partial<
  Record<"email" | "password" | "role" | "branchIds", string>
>;

export const EMPTY_USER_FORM: UserFormValues = {
  email: "",
  password: "",
  role: "",
  isActive: true,
  branchIds: [],
  defaultBranchId: "",
};

/** What the edit dialog opens with: everything the user has today (GES-02). */
export function userToFormValues(user: User): UserFormValues {
  const branchIds = user.branches.map((branch) => branch.id);
  return {
    email: user.email,
    password: "",
    role: user.role,
    isActive: user.isActive,
    branchIds,
    defaultBranchId:
      user.defaultBranchId && branchIds.includes(user.defaultBranchId)
        ? user.defaultBranchId
        : branchIds[0] ?? "",
  };
}

/**
 * Ticks or unticks a branch. The default stays while it is still ticked;
 * otherwise it moves to the first ticked branch (or none, if none is left).
 */
export function toggleBranch(
  values: UserFormValues,
  branchId: string,
  checked: boolean,
): UserFormValues {
  const branchIds = checked
    ? Array.from(new Set([...values.branchIds, branchId]))
    : values.branchIds.filter((id) => id !== branchId);
  const defaultBranchId = branchIds.includes(values.defaultBranchId)
    ? values.defaultBranchId
    : branchIds[0] ?? "";
  return { ...values, branchIds, defaultBranchId };
}

export function validateUserForm(
  values: UserFormValues,
  mode: "create" | "edit",
): UserFormErrors {
  const errors: UserFormErrors = {};

  const email = normalizeEmail(values.email);
  if (!email) errors.email = "Ingresá el email.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "El email no es válido.";

  // On edit an empty password keeps the current one; anything typed is
  // checked and sent, never dropped silently.
  if (mode === "create" && !values.password) {
    errors.password = "Ingresá una contraseña.";
  } else if (values.password && !isValidPassword(values.password)) {
    errors.password = PASSWORD_HINT;
  }

  if (!values.role) errors.role = "Elegí un rol.";

  if (!values.branchIds.length) {
    errors.branchIds = "Asigná al menos una sucursal.";
  }

  return errors;
}

export function hasErrors(errors: UserFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Call only after validateUserForm returned no errors. */
export function toCreateUserRequest(values: UserFormValues): CreateUserRequest {
  return {
    email: normalizeEmail(values.email),
    password: values.password,
    role: values.role as UserRole,
    isActive: values.isActive,
    branchIds: values.branchIds,
    defaultBranchId: values.defaultBranchId || undefined,
  };
}

/**
 * Sends the whole form (the backend writes and audits only what changed),
 * plus the password only when one was typed.
 */
export function toUpdateUserRequest(values: UserFormValues): UpdateUserRequest {
  const { password, ...rest } = toCreateUserRequest(values);
  return password ? { ...rest, password } : rest;
}
