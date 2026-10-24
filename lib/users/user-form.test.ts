import { describe, expect, it } from "vitest";
import type { User } from "@/lib/api-types";
import {
  ASSIGNABLE_ROLES,
  EMPTY_USER_FORM,
  isValidPassword,
  toCreateUserRequest,
  toUpdateUserRequest,
  toggleBranch,
  userToFormValues,
  validateUserForm,
  type UserFormValues,
} from "./user-form";

const A = "branch-a";
const B = "branch-b";

const cashier: User = {
  id: "u1",
  email: "cajero@negocio.com",
  role: "cashier",
  isActive: true,
  branches: [
    { id: A, name: "Alberdi" },
    { id: B, name: "Belgrano" },
  ],
  defaultBranchId: B,
};

function form(overrides: Partial<UserFormValues> = {}): UserFormValues {
  return {
    email: "nuevo@negocio.com",
    password: "clave1234",
    role: "seller",
    isActive: true,
    branchIds: [A],
    defaultBranchId: A,
    ...overrides,
  };
}

describe("abrir la edición carga lo que el usuario tiene hoy (GES-02)", () => {
  it("email, rol, estado, sucursales y sucursal por defecto; la contraseña vacía", () => {
    expect(userToFormValues(cashier)).toEqual({
      email: "cajero@negocio.com",
      password: "",
      role: "cashier",
      isActive: true,
      branchIds: [A, B],
      defaultBranchId: B,
    });
  });

  it("guardar sin tocar nada reenvía exactamente sus sucursales, sin contraseña", () => {
    expect(toUpdateUserRequest(userToFormValues(cashier))).toEqual({
      email: "cajero@negocio.com",
      role: "cashier",
      isActive: true,
      branchIds: [A, B],
      defaultBranchId: B,
    });
  });

  it("sin sucursal por defecto válida, propone la primera", () => {
    expect(
      userToFormValues({ ...cashier, defaultBranchId: null }).defaultBranchId,
    ).toBe(A);
  });
});

describe("sucursales del formulario", () => {
  it("destildar la de por defecto la pasa a la primera que queda", () => {
    const values = toggleBranch(form({ branchIds: [A, B], defaultBranchId: A }), A, false);
    expect(values).toMatchObject({ branchIds: [B], defaultBranchId: B });
  });

  it("tildar otra no cambia la de por defecto", () => {
    const values = toggleBranch(form(), B, true);
    expect(values).toMatchObject({ branchIds: [A, B], defaultBranchId: A });
  });

  it("la primera que se tilda queda por defecto", () => {
    const values = toggleBranch(form({ branchIds: [], defaultBranchId: "" }), B, true);
    expect(values.defaultBranchId).toBe(B);
  });
});

describe("validación: las mismas reglas que el backend (GES-08)", () => {
  it("la contraseña pide 8 caracteres con al menos una letra y un número", () => {
    expect(isValidPassword("clave123")).toBe(true);
    expect(isValidPassword("clave12")).toBe(false);
    expect(isValidPassword("solotexto")).toBe(false);
    expect(isValidPassword("12345678")).toBe(false);
  });

  it("en la edición, una contraseña corta da error: no se descarta en silencio", () => {
    expect(validateUserForm(form({ password: "abc" }), "edit").password).toBeDefined();
    expect(validateUserForm(form({ password: "" }), "edit")).toEqual({});
  });

  it("el alta exige contraseña, rol, email válido y al menos una sucursal", () => {
    expect(Object.keys(validateUserForm(EMPTY_USER_FORM, "create")).sort()).toEqual([
      "branchIds",
      "email",
      "password",
      "role",
    ]);
    expect(validateUserForm(form({ email: "sin-arroba" }), "create").email).toBeDefined();
    expect(validateUserForm(form(), "create")).toEqual({});
  });

  it("solo ofrece roles que pueden operar", () => {
    expect([...ASSIGNABLE_ROLES].sort()).toEqual(["admin", "cashier", "seller"]);
  });
});

describe("lo que se envía", () => {
  it("el email va sin espacios y en minúsculas; la contraseña tal cual se escribió", () => {
    expect(
      toCreateUserRequest(form({ email: "  Juan@Negocio.COM ", password: " clave1234" })),
    ).toMatchObject({ email: "juan@negocio.com", password: " clave1234" });
  });

  it("en la edición, la contraseña solo va si se escribió una", () => {
    expect(toUpdateUserRequest(form({ password: "" }))).not.toHaveProperty("password");
    expect(toUpdateUserRequest(form({ password: "otra1234" }))).toHaveProperty(
      "password",
      "otra1234",
    );
  });
});
