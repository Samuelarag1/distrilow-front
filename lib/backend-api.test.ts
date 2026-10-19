import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SUC-10 (docs/audit/controles.md): money and stock writes send the branch in
// the body too — the branch the screen was showing — next to x-branch-id,
// which comes from the active branch. If both ever disagree, the backend
// answers 400 instead of writing into another branch. backendApi must pass
// the caller's branch through untouched: overwriting it with the header's
// would turn the check into a tautology.

// Fresh module instances per test, like lib/api-client.test.ts: the session
// and the active branch live in module-level variables.
async function freshBackendApi() {
  vi.resetModules();
  const { backendApi } = await import("./backend-api");
  const session = await import("./session");
  const activeBranch = await import("./active-branch");

  session.applySession(
    {
      accessToken: "token",
      user: { id: "ana", email: "ana@x.com", role: "admin" },
      session: {
        availableBranches: [
          { id: "branch-A", name: "A" },
          { id: "branch-B", name: "B" },
        ],
        activeBranchId: "branch-A",
      },
    },
    "login"
  );

  return { backendApi, ...activeBranch };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ id: "x", branchId: "branch-A" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sentRequest() {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url,
    body: JSON.parse(String(init.body)) as Record<string, unknown>,
    branchHeader: new Headers(init.headers).get("x-branch-id"),
  };
}

type BackendApi = Awaited<ReturnType<typeof freshBackendApi>>["backendApi"];

const WRITES: Array<[string, (api: BackendApi, branchId: string) => Promise<unknown>]> = [
  ["POST /sales", (api, branchId) => api.sales.create({ branchId, items: [] })],
  [
    "POST /expenses",
    (api, branchId) =>
      api.expenses.create({ branchId, description: "Luz", amount: 100, category: "OTHER" as never }),
  ],
  [
    "POST /stock-movements",
    (api, branchId) =>
      api.stockMovements.create({ branchId, productId: "p", type: "ADJUSTMENT", quantity: 1 } as never),
  ],
  [
    "POST /stock-movements/adjustment-in",
    (api, branchId) =>
      api.stockMovements.adjustmentIn({ branchId, productId: "p", type: "ADJUSTMENT", quantity: 1 } as never),
  ],
  [
    "POST /stock-movements/adjustment-out",
    (api, branchId) =>
      api.stockMovements.adjustmentOut({ branchId, productId: "p", type: "ADJUSTMENT", quantity: 1 } as never),
  ],
  ["POST /cash/sessions/open", (api, branchId) => api.cash.openSession({ branchId, openingFloat: 0 })],
  [
    "POST /cash/sessions/:id/movements",
    (api, branchId) => api.cash.addMovement("s1", { branchId, type: "IN" as never, reason: "x", amount: 1 }),
  ],
  [
    "POST /cash/sessions/:id/close",
    (api, branchId) => api.cash.closeSession("s1", { branchId, countedCash: 0 }),
  ],
];

describe("SUC-10 — la sucursal viaja tambien en el body de las escrituras de dinero y stock", () => {
  it.each(WRITES)("%s manda en el body la sucursal de la pantalla", async (_name, write) => {
    const { backendApi } = await freshBackendApi();

    await write(backendApi, "branch-A");

    const { body, branchHeader } = sentRequest();
    expect(body.branchId).toBe("branch-A");
    expect(branchHeader).toBe("branch-A");
  });

  it.each(WRITES)(
    "%s no pisa la sucursal de la pantalla con la del header, asi el backend detecta la diferencia",
    async (_name, write) => {
      const { backendApi, selectBranch } = await freshBackendApi();
      // The form was filled on branch A's screen, but by the time it is sent
      // the tab's active branch is B.
      selectBranch("branch-B");

      await write(backendApi, "branch-A");

      const { body, branchHeader } = sentRequest();
      expect(body.branchId).toBe("branch-A");
      expect(branchHeader).toBe("branch-B");
    }
  );

  it("POST /stocks/lots manda la misma sucursal en el header y en el body", async () => {
    const { backendApi } = await freshBackendApi();

    await backendApi.stocks.lots.create(
      { productId: "p", lotCode: "L1", expiresAt: "2026-12-31", quantity: 1 },
      "branch-A"
    );

    const { body, branchHeader } = sentRequest();
    expect(body.branchId).toBe("branch-A");
    expect(branchHeader).toBe("branch-A");
  });
});
