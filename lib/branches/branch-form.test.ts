import { describe, expect, it } from "vitest";
import type { Branch } from "@/lib/api-types";
import {
  EMPTY_BRANCH_FORM,
  branchToFormValues,
  toBranchRequest,
  validateBranchForm,
} from "./branch-form";

const branch: Branch = {
  id: "b1",
  code: "SUC-001",
  name: "Centro",
  address: "San Martín 50",
  branchType: "WAREHOUSE",
  isActive: true,
  phone: null,
  email: "centro@negocio.com",
};

describe("abrir la edición carga los datos de la sucursal", () => {
  it("todos los campos editables, con los vacíos como texto vacío", () => {
    expect(branchToFormValues(branch)).toEqual({
      code: "SUC-001",
      name: "Centro",
      address: "San Martín 50",
      branchType: "WAREHOUSE",
      phone: "",
      email: "centro@negocio.com",
    });
  });
});

describe("lo que se envía (S1: contrato con el backend)", () => {
  it("lleva exactamente los campos que el backend acepta, sin isActive ni banderas", () => {
    expect(Object.keys(toBranchRequest(branchToFormValues(branch))).sort()).toEqual([
      "address",
      "branchType",
      "code",
      "email",
      "name",
      "phone",
    ]);
  });

  it("guardar sin cambios reenvía lo mismo que se leyó", () => {
    expect(toBranchRequest(branchToFormValues(branch))).toEqual({
      code: "SUC-001",
      name: "Centro",
      address: "San Martín 50",
      branchType: "WAREHOUSE",
      phone: null,
      email: "centro@negocio.com",
    });
  });

  it("recorta espacios, y teléfono o email vacíos van como null para borrarlos", () => {
    expect(
      toBranchRequest({
        ...EMPTY_BRANCH_FORM,
        code: " S-2 ",
        name: " Norte ",
        address: " Ruta 9 ",
        phone: "  ",
        email: "",
      }),
    ).toMatchObject({ code: "S-2", name: "Norte", address: "Ruta 9", phone: null, email: null });
  });
});

describe("validación", () => {
  it("código, nombre y dirección son obligatorios; el email, si está, tiene que ser válido", () => {
    expect(Object.keys(validateBranchForm(EMPTY_BRANCH_FORM)).sort()).toEqual([
      "address",
      "code",
      "name",
    ]);
    expect(
      validateBranchForm({ ...branchToFormValues(branch), email: "no-es-email" }).email,
    ).toBeDefined();
    expect(validateBranchForm(branchToFormValues(branch))).toEqual({});
  });
});
