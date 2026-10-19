import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// api-client.ts and lib/session.ts intentionally keep session state (the
// access token, the active branch, refresh timestamps) in module-level
// variables — one instance per tab, reset on reload by design. Tests that
// just `import` them once would leak state between `it()` blocks.
//
// vi.resetModules() + a fresh dynamic import before every test gives each
// test its own clean module instances (the equivalent of a fresh page load),
// so assertions don't depend on test execution order. Modules imported after
// freshApiClient() in the same test share those fresh instances.
async function freshApiClient() {
  vi.resetModules();
  const apiClient = await import("./api-client");
  const session = await import("./session");
  const activeBranch = await import("./active-branch");
  return { ...apiClient, ...session, ...activeBranch };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("H2 — fallo de red ≠ sesión inválida (docs/design/01-login-y-sesion.md, AUT-04)", () => {
  it("un error de red transitorio no bloquea un refresh valido justo despues", async () => {
    const { refreshSessionIfNeeded, getApiSession } = await freshApiClient();

    // El backend/la red no responde (POS sin conexion, backend reiniciando).
    // No es una sesion invalida: es una sesion que no se pudo consultar.
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await refreshSessionIfNeeded(0)).toBe("unavailable");

    // La red se recupera y el refresh token (cookie httpOnly) sigue valido.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        accessToken: "new-access-token",
        session: { activeBranchId: null, availableBranches: [] },
      })
    );
    expect(await refreshSessionIfNeeded(0)).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getApiSession().accessToken).toBe("new-access-token");
  });

  it.each([401, 403])("un %i del refresh es una sesion terminada (invalid)", async (status) => {
    const { refreshSessionIfNeeded } = await freshApiClient();

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "no" }, status));

    expect(await refreshSessionIfNeeded(0)).toBe("invalid");
  });

  it.each([429, 500, 502, 503])(
    "un %i del refresh no es un 'no': la sesion se conserva (unavailable)",
    async (status) => {
      const { refreshSessionIfNeeded } = await freshApiClient();

      fetchMock.mockResolvedValueOnce(jsonResponse({ message: "busy" }, status));

      expect(await refreshSessionIfNeeded(0)).toBe("unavailable");
    }
  );

  it("si el servidor pide esperar (Retry-After), no se reintenta antes de tiempo", async () => {
    const { refreshSessionIfNeeded } = await freshApiClient();

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "Too Many Requests" }, 429, { "Retry-After": "30" })
    );
    expect(await refreshSessionIfNeeded(0)).toBe("unavailable");

    expect(await refreshSessionIfNeeded(0)).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("una request cuyo refresh no tiene respuesta falla sin cerrar la sesion", async () => {
    const { apiClientFetch, applySession, getApiSession, reconcileActiveBranch, ApiError } =
      await freshApiClient();

    applySession({ accessToken: "expired-token" }, "login");
    reconcileActiveBranch({ userId: "u", branches: [{ id: "branch-A" }] });

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, 401))
      .mockRejectedValueOnce(new Error("network down"));

    const failure = apiClientFetch.get("/sales").catch((error: unknown) => error);
    const error = await failure;

    expect(error).toBeInstanceOf(ApiError);
    expect((error as InstanceType<typeof ApiError>).status).toBe(503);
    // Nada se borro: cuando vuelva la red, la sesion sigue ahi.
    expect(getApiSession()).toEqual({ accessToken: "expired-token", branchId: "branch-A" });
  });
});

describe("H7 — cambio de identidad (docs/design/01-login-y-sesion.md, invariante I1)", () => {
  function stubBrowserWindow() {
    const reload = vi.fn();
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      location: { pathname: "/pos", href: "/pos", reload },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    return { reload, storage };
  }

  it("si el refresh trae otro usuario, la pestana no adopta esa sesion y se recarga", async () => {
    const { reload } = stubBrowserWindow();
    const { refreshSessionIfNeeded, applySession, getSession, consumeIdentityChangedNotice } =
      await freshApiClient();

    // La pestana opera como Ana.
    applySession(
      { accessToken: "token-ana", user: { id: "ana", email: "ana@x.com", role: "seller" } },
      "login"
    );

    // Ana cerro sesion en otra pestana y entro Beto: la cookie compartida
    // ahora es de Beto, y el proximo refresh de esta pestana lo trae a el.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        accessToken: "token-beto",
        user: { id: "beto", email: "beto@x.com", role: "admin" },
        session: { activeBranchId: null, availableBranches: [] },
      })
    );

    expect(await refreshSessionIfNeeded(0)).toBe("invalid");
    expect(getSession().accessToken).toBe("token-ana");
    expect(getSession().user?.id).toBe("ana");
    expect(reload).toHaveBeenCalledTimes(1);
    // Despues de recargar se le avisa por que.
    expect(consumeIdentityChangedNotice()).toBe(true);
  });

  it("la request que disparo ese refresh no se reintenta como el otro usuario", async () => {
    stubBrowserWindow();
    const { apiClientFetch, applySession, ApiError } = await freshApiClient();

    applySession(
      { accessToken: "token-ana", user: { id: "ana", email: "ana@x.com", role: "seller" } },
      "login"
    );

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: "token-beto",
          user: { id: "beto", email: "beto@x.com", role: "admin" },
          session: { activeBranchId: null, availableBranches: [] },
        })
      );

    const error = await apiClientFetch.get("/sales").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as InstanceType<typeof ApiError>).status).toBe(401);
    // La request original y el refresh; ningun reintento con el token de Beto.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("el mismo usuario renovando su token no es un cambio de identidad", async () => {
    const { reload } = stubBrowserWindow();
    const { refreshSessionIfNeeded, applySession, getSession } = await freshApiClient();

    applySession(
      { accessToken: "token-ana", user: { id: "ana", email: "ana@x.com", role: "seller" } },
      "login"
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        accessToken: "token-ana-2",
        user: { id: "ana", email: "ana@x.com", role: "seller" },
        session: { activeBranchId: null, availableBranches: [] },
      })
    );

    expect(await refreshSessionIfNeeded(0)).toBe("ok");
    expect(getSession().accessToken).toBe("token-ana-2");
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("H3b — el refresh no pisa la sucursal elegida (docs/design/01-login-y-sesion.md)", () => {
  // Control SUC-06 (docs/audit/controles.md). Antes fallaba: refreshSession()
  // pisaba la sucursal con el claim activeBranchId del refresh token, que
  // nunca cambia, y el POS terminaba en 400 "Branch mismatch".
  it("el refresh no cambia la sucursal que eligio el usuario", async () => {
    const { applySession, getApiSession, refreshSessionIfNeeded, reconcileActiveBranch, selectBranch } =
      await freshApiClient();

    applySession({ accessToken: "old-access-token" }, "login");
    reconcileActiveBranch({
      userId: "user-1",
      branches: [{ id: "branch-A" }, { id: "branch-B" }],
      serverDefaultBranchId: "branch-A",
    });
    selectBranch("branch-B");

    // El refresh token sigue firmado con la sucursal de login (A).
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        accessToken: "new-access-token",
        user: { id: "user-1" },
        session: {
          activeBranchId: "branch-A",
          availableBranches: [{ id: "branch-A" }, { id: "branch-B" }],
        },
      })
    );

    await refreshSessionIfNeeded(0);

    expect(getApiSession().branchId).toBe("branch-B");
  });

  it("si al renovar el usuario ya no tiene acceso a la sucursal activa, se descarta", async () => {
    const { getApiSession, refreshSessionIfNeeded, reconcileActiveBranch, selectBranch } =
      await freshApiClient();

    reconcileActiveBranch({
      userId: "user-1",
      branches: [{ id: "branch-A" }, { id: "branch-B" }],
    });
    selectBranch("branch-B");

    // Un admin le quito la sucursal B; el servidor ya no la incluye.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        accessToken: "new-access-token",
        user: { id: "user-1" },
        session: { activeBranchId: "branch-A", availableBranches: [{ id: "branch-A" }] },
      })
    );

    await refreshSessionIfNeeded(0);

    // No cae en "la otra sucursal" por su cuenta salvo que sea el default
    // del servidor — aca lo es, y es una decision del servidor, no del front.
    expect(getApiSession().branchId).toBe("branch-A");
  });
});

describe("x-branch-id — una sola fuente para el header (docs/audit/controles.md SUC-04/SUC-05)", () => {
  function sentHeader(callIndex: number, name: string) {
    const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
    return new Headers(init.headers).get(name);
  }

  it("toda request lleva la sucursal activa, incluso rutas que antes no estaban en la lista", async () => {
    const { apiClientFetch, applySession, reconcileActiveBranch, selectBranch } =
      await freshApiClient();

    applySession({ accessToken: "token" }, "login");
    reconcileActiveBranch({ userId: "u", branches: [{ id: "branch-A" }, { id: "branch-B" }] });
    selectBranch("branch-B");

    fetchMock.mockImplementation(async () => jsonResponse({}));
    await apiClientFetch.get("/commercial-intelligence/summary");
    await apiClientFetch.get("/sales");

    expect(sentHeader(0, "x-branch-id")).toBe("branch-B");
    expect(sentHeader(1, "x-branch-id")).toBe("branch-B");
  });

  it("sin sucursal activa no se adivina ninguna: el header no se envia", async () => {
    const { apiClientFetch, applySession, reconcileActiveBranch } = await freshApiClient();

    applySession({ accessToken: "token" }, "login");
    // Varias sucursales, ninguna elegida y sin default del servidor.
    reconcileActiveBranch({ userId: "u", branches: [{ id: "branch-A" }, { id: "branch-B" }] });

    fetchMock.mockImplementation(async () => jsonResponse({}));
    await apiClientFetch.get("/sales");

    expect(sentHeader(0, "x-branch-id")).toBeNull();
  });

  it("el reintento tras un 401 va a la misma sucursal que el primer intento", async () => {
    const { apiClientFetch, applySession, reconcileActiveBranch, selectBranch } =
      await freshApiClient();

    applySession({ accessToken: "expired-token" }, "login");
    reconcileActiveBranch({ userId: "u", branches: [{ id: "branch-A" }, { id: "branch-B" }] });
    selectBranch("branch-A");

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, 401))
      .mockImplementationOnce(async () => {
        // El usuario cambia de sucursal mientras se renueva el token.
        selectBranch("branch-B");
        return jsonResponse({
          accessToken: "new-token",
          user: { id: "u" },
          session: {
            activeBranchId: null,
            availableBranches: [{ id: "branch-A" }, { id: "branch-B" }],
          },
        });
      })
      .mockResolvedValueOnce(jsonResponse([]));

    await apiClientFetch.get("/sales");

    expect(sentHeader(0, "x-branch-id")).toBe("branch-A");
    expect(sentHeader(2, "x-branch-id")).toBe("branch-A");
    expect(sentHeader(2, "Authorization")).toBe("Bearer new-token");
  });

  it("el refresh no manda Authorization: el backend solo lee la cookie httpOnly", async () => {
    const { refreshSessionIfNeeded, applySession } = await freshApiClient();

    applySession({ accessToken: "old-token" }, "login");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ accessToken: "new-token", session: { availableBranches: [] } })
    );

    await refreshSessionIfNeeded(0);

    expect(sentHeader(0, "Authorization")).toBeNull();
  });
});

describe("login durante el refresh de carga de pagina (no pedir credenciales dos veces)", () => {
  it("un refresh iniciado antes del login que despues falla no toca la sesion nueva", async () => {
    const { refreshSessionIfNeeded, applySession, getApiSession, getSessionEpoch } =
      await freshApiClient();

    let answerRefresh: (res: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { answerRefresh = resolve; })
    );

    // Carga de /login: el refresh queda en vuelo.
    const epochAtPageLoad = getSessionEpoch();
    const pageLoadRefresh = refreshSessionIfNeeded(0);

    // El usuario inicia sesion mientras tanto.
    applySession({ accessToken: "login-token" }, "login");

    // El refresh viejo responde 401 recien ahora.
    answerRefresh(jsonResponse({ message: "no session" }, 401));
    await pageLoadRefresh;

    expect(getSessionEpoch()).not.toBe(epochAtPageLoad);
    expect(getApiSession().accessToken).toBe("login-token");
  });
});
