import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/session.ts is the single writer of the session (docs/design/01 §12.5
// paso 3, invariante I8). Fresh module per test: its state is per tab.
async function freshSession() {
  vi.resetModules();
  const session = await import("./session");
  const activeBranch = await import("./active-branch");
  return { ...session, ...activeBranch };
}

describe("lib/session.ts — un solo escritor de la sesion", () => {
  let listener: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    listener = vi.fn<() => void>();
  });

  it("aplica token, usuario y sucursales en una sola escritura y avisa a React", async () => {
    const { applySession, getSession, subscribeSession, getActiveBranchId } =
      await freshSession();
    subscribeSession(listener);

    applySession(
      {
        accessToken: "token",
        user: { id: "ana", email: "ana@x.com", role: "seller" },
        session: {
          activeBranchId: "branch-A",
          availableBranches: [{ id: "branch-A", name: "Centro", isDefault: true }],
          needsOnboarding: false,
        },
      },
      "login"
    );

    expect(getSession()).toEqual({
      accessToken: "token",
      user: { id: "ana", email: "ana@x.com", role: "seller" },
      branches: [{ id: "branch-A", name: "Centro", isDefault: true }],
      needsOnboarding: false,
    });
    expect(getActiveBranchId()).toBe("branch-A");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("normaliza las sucursales en un solo lugar (ids sueltos, branchId, valores vacios)", async () => {
    const { applySession, getSession } = await freshSession();

    applySession(
      {
        session: {
          availableBranches: [
            "branch-A",
            { branchId: "branch-B", name: "Norte" },
            { id: "null" },
            { id: "  " },
          ] as never,
        },
      },
      "onboarding"
    );

    expect(getSession().branches).toEqual([
      { id: "branch-A", name: "Sucursal 1" },
      { id: "branch-B", name: "Norte", isDefault: false },
    ]);
  });

  it("las pistas de las cookies nunca pisan una sesion que ya esta en memoria", async () => {
    const { applySession, getSession } = await freshSession();

    applySession(
      { accessToken: "token", user: { id: "ana", email: "ana@x.com", role: "seller" } },
      "login"
    );
    applySession({ user: { id: "beto", email: "beto@x.com", role: "admin" } }, "hint");

    expect(getSession().user?.id).toBe("ana");
  });

  it("otro usuario solo reemplaza la sesion de la pestana si es un login", async () => {
    const { applySession, getSession } = await freshSession();
    const ana = { id: "ana", email: "ana@x.com", role: "seller" };
    const beto = { id: "beto", email: "beto@x.com", role: "admin" };

    applySession({ accessToken: "token-ana", user: ana }, "login");

    expect(applySession({ accessToken: "token-beto", user: beto }, "refresh")).toBe(
      "identity-changed"
    );
    expect(getSession().accessToken).toBe("token-ana");

    expect(applySession({ accessToken: "token-beto", user: beto }, "login")).toBe("applied");
    expect(getSession().user?.id).toBe("beto");
  });

  it("sin token todavia (carga de pagina) no hay identidad que comparar", async () => {
    const { applySession, getSession } = await freshSession();

    // Pista optimista de la cookie `user`, que puede haber quedado vieja.
    applySession({ user: { id: "ana", email: "ana@x.com", role: "seller" } }, "hint");

    expect(
      applySession(
        { accessToken: "token-beto", user: { id: "beto", email: "beto@x.com", role: "admin" } },
        "refresh"
      )
    ).toBe("applied");
    expect(getSession().user?.id).toBe("beto");
  });

  it("clearSession borra todo y deja obsoleto cualquier refresh en vuelo", async () => {
    const { applySession, clearSession, getSession, getSessionEpoch, getActiveBranchId } =
      await freshSession();

    applySession(
      {
        accessToken: "token",
        user: { id: "ana", email: "ana@x.com", role: "seller" },
        session: { availableBranches: [{ id: "branch-A", name: "Centro" }] },
      },
      "login"
    );
    const epoch = getSessionEpoch();

    clearSession();

    expect(getSession()).toEqual({
      accessToken: null,
      user: null,
      branches: [],
      needsOnboarding: false,
    });
    expect(getActiveBranchId()).toBeNull();
    expect(getSessionEpoch()).not.toBe(epoch);
  });
});
