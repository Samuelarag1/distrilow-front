import { describe, expect, it } from "vitest";
import {
  canManageCash,
  isPathAllowedForPosCashOnly,
  isPosCashOnlyUser,
  resolvePostLoginPath,
} from "./permissions";

describe("permisos por rol (una sola fuente para middleware, menú y pantallas)", () => {
  it("manejan caja admin, cajero y vendedor; staff no", () => {
    expect(canManageCash("admin")).toBe(true);
    expect(canManageCash("cashier")).toBe(true);
    expect(canManageCash("seller")).toBe(true);
    expect(canManageCash("staff")).toBe(false);
    expect(canManageCash(null)).toBe(false);
  });

  it("solo POS y caja: el vendedor siempre, el resto sin gestión con una sucursal o menos", () => {
    expect(isPosCashOnlyUser("seller", 3)).toBe(true);
    expect(isPosCashOnlyUser("cashier", 1)).toBe(true);
    expect(isPosCashOnlyUser("cashier", 2)).toBe(false);
    expect(isPosCashOnlyUser("admin", 0)).toBe(false);
    expect(isPosCashOnlyUser(undefined, 0)).toBe(false);
  });

  it("las rutas de un usuario solo POS y caja", () => {
    expect(isPathAllowedForPosCashOnly("/pos")).toBe(true);
    expect(isPathAllowedForPosCashOnly("/cash/history")).toBe(true);
    expect(isPathAllowedForPosCashOnly("/onboarding/branch")).toBe(true);
    expect(isPathAllowedForPosCashOnly("/")).toBe(false);
    expect(isPathAllowedForPosCashOnly("/posters")).toBe(false);
    expect(isPathAllowedForPosCashOnly("/users")).toBe(false);
  });
});

describe("resolvePostLoginPath: a dónde ir después del login (?next=)", () => {
  const admin = { posCashOnly: false, needsOnboarding: false };
  const cashier = { posCashOnly: true, needsOnboarding: false };

  it("sin next: el inicio de cada usuario", () => {
    expect(resolvePostLoginPath(null, admin)).toBe("/");
    expect(resolvePostLoginPath(null, cashier)).toBe("/pos");
  });

  it("vuelve a la pantalla donde venció la sesión, con su query", () => {
    expect(resolvePostLoginPath("/sales?from=2026-10-01", admin)).toBe(
      "/sales?from=2026-10-01"
    );
    expect(resolvePostLoginPath("/cash", cashier)).toBe("/cash");
  });

  it("nunca a otro sitio (redirección abierta)", () => {
    for (const next of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "evil.com/pos",
      "/pos\n//evil.com",
    ]) {
      expect(resolvePostLoginPath(next, admin)).toBe("/");
    }
  });

  it("ni al login otra vez, ni a una pantalla que el usuario no puede abrir", () => {
    expect(resolvePostLoginPath("/login?next=/users", admin)).toBe("/");
    expect(resolvePostLoginPath("/users", cashier)).toBe("/pos");
  });

  it("si falta elegir la primera sucursal, el onboarding va primero", () => {
    expect(
      resolvePostLoginPath("/sales", { posCashOnly: false, needsOnboarding: true })
    ).toBe("/onboarding/branch");
  });
});
