import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDailyCash, fetchMonthlyCashOverview } from "./cash-calendar-data";

const api = vi.hoisted(() => ({
  dailyBook: vi.fn(),
  overview: vi.fn(),
  monthly: vi.fn(),
}));
vi.mock("@/lib/backend-api", () => ({
  backendApi: {
    cash: { dailyBook: api.dailyBook },
    reporting: { cash: { overview: api.overview, monthly: api.monthly } },
  },
}));
// Los adaptadores reales tienen sus propios datos; acá solo importa qué camino se toma.
vi.mock("@/lib/adapters/cash-overview", () => ({
  normalizeCashOverviewResponse: (_payload: unknown, opts: { groupBy: string }) => ({
    items: [{ origen: "ruta nueva", groupBy: opts.groupBy }],
  }),
  buildCashOverviewFromLegacyDailyBook: (_payload: unknown, groupBy: string) => ({
    items: [{ origen: "armado desde el libro", groupBy }],
  }),
  buildCashOverviewFromLegacyMonthly: () => ({ origen: "ruta vieja" }),
}));

const BOOK = { date: "2026-09-10", entries: [] };

beforeEach(() => {
  api.dailyBook.mockReset();
  api.overview.mockReset();
  api.monthly.mockReset();
});

describe("fetchDailyCash", () => {
  it("pide el libro y los dos resúmenes del día juntos, sin esperar al libro", async () => {
    let releaseBook!: (value: unknown) => void;
    api.dailyBook.mockReturnValue(new Promise((resolve) => (releaseBook = resolve)));
    api.overview.mockResolvedValue({ items: [] });

    const result = fetchDailyCash("b1", "2026-09-10");
    await Promise.resolve();
    // El libro sigue sin responder y los dos resúmenes ya salieron.
    expect(api.overview).toHaveBeenCalledTimes(2);
    expect(api.overview.mock.calls.map((call) => call[0].groupBy)).toEqual(["day", "session"]);

    releaseBook(BOOK);
    await expect(result).resolves.toEqual({
      payload: BOOK,
      dayOverview: { origen: "ruta nueva", groupBy: "day" },
      sessionRows: [{ origen: "ruta nueva", groupBy: "session" }],
    });
  });

  it("si falla un resumen, arma los dos desde el libro, como antes", async () => {
    api.dailyBook.mockResolvedValue(BOOK);
    api.overview.mockImplementation(async (query: { groupBy: string }) => {
      if (query.groupBy === "session") throw new Error("sin ruta");
      return { items: [] };
    });

    await expect(fetchDailyCash("b1", "2026-09-10")).resolves.toEqual({
      payload: BOOK,
      dayOverview: { origen: "armado desde el libro", groupBy: "day" },
      sessionRows: [{ origen: "armado desde el libro", groupBy: "session" }],
    });
  });

  it("si falla el libro, falla todo", async () => {
    api.dailyBook.mockRejectedValue(new Error("No se pudo cargar el libro"));
    api.overview.mockResolvedValue({ items: [] });

    await expect(fetchDailyCash("b1", "2026-09-10")).rejects.toThrow(
      "No se pudo cargar el libro"
    );
  });
});

describe("fetchMonthlyCashOverview", () => {
  const range = {
    fromMonth: "2026-04",
    toMonth: "2026-09",
    fromDate: "2026-04-01",
    toDate: "2026-09-30",
  };

  it("usa la ruta nueva, agrupada por mes", async () => {
    api.overview.mockResolvedValue({ items: [] });

    await expect(fetchMonthlyCashOverview("b1", range)).resolves.toEqual({
      items: [{ origen: "ruta nueva", groupBy: "month" }],
    });
    expect(api.overview.mock.calls[0][0]).toEqual({
      branchId: "b1",
      from: "2026-04-01",
      to: "2026-09-30",
      groupBy: "month",
    });
    expect(api.monthly).not.toHaveBeenCalled();
  });

  it("si la ruta nueva falla, usa la vieja con los mismos meses", async () => {
    api.overview.mockRejectedValue(new Error("sin ruta"));
    api.monthly.mockResolvedValue({});

    await expect(fetchMonthlyCashOverview("b1", range)).resolves.toEqual({
      origen: "ruta vieja",
    });
    expect(api.monthly.mock.calls[0][0]).toEqual({
      branchId: "b1",
      fromMonth: "2026-04",
      toMonth: "2026-09",
    });
  });
});
