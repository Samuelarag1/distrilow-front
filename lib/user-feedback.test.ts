import { describe, expect, it } from "vitest";
import { getUserFacingErrorMessage } from "./user-feedback";

describe("mensajes del login", () => {
  it("una cuenta desactivada se explica en castellano", () => {
    expect(getUserFacingErrorMessage(new Error("User is not active"))).toBe(
      "Tu usuario está desactivado. Pedile a un administrador que lo active."
    );
  });

  it("credenciales inválidas no dicen si el email existe", () => {
    expect(getUserFacingErrorMessage(new Error("Invalid Credentials"))).toBe(
      "Revisá tu email y tu contraseña, y volvé a intentar."
    );
  });
});
