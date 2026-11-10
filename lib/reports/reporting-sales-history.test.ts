import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnalyticsMetric,
  AnalyticsSalesBatchQuery,
  AnalyticsSalesResponse,
} from "@/lib/api-types";

import { fetchReportingSalesSeries } from "./reporting-sales-history";

const { history, historyBatch } = vi.hoisted(() => ({
  history: vi.fn(),
  historyBatch: vi.fn(),
}));
vi.mock("@/lib/backend-api", () => ({
  backendApi: { reporting: { sales: { history, historyBatch } } },
}));

function seriesFor(query: AnalyticsSalesBatchQuery) {
  return {
    series: query.metrics.map(
      (metric): AnalyticsSalesResponse => ({
        range: { from: query.from, to: query.to },
        groupBy: query.groupBy,
        metric,
        currency: "ARS",
        points: [{ period: query.from, value: metric.length }],
        totals: { value: metric.length * 10 },
      })
    ),
  };
}

// Cada test usa su propio mes: la caché es del módulo y vive entre tests.
function month(m: number) {
  return { from: new Date(2025, m, 1, 12), to: new Date(2025, m, 28, 12) };
}

const ALL: AnalyticsMetric[] = ["revenue", "profit", "count", "avgTicket"];

beforeEach(() => {
  historyBatch.mockReset();
  history.mockReset();
  historyBatch.mockImplementation(async (query: AnalyticsSalesBatchQuery) =>
    seriesFor(query)
  );
});

describe("fetchReportingSalesSeries", () => {
  it("pide las cuatro métricas en un solo pedido, no en cuatro", async () => {
    const result = await fetchReportingSalesSeries(month(0), "day", ALL);

    expect(historyBatch).toHaveBeenCalledTimes(1);
    expect(historyBatch).toHaveBeenCalledWith({
      from: "2025-01-01",
      to: "2025-01-28",
      groupBy: "day",
      metrics: ALL,
    });
    expect(history).not.toHaveBeenCalled();
    expect(result.profit).toEqual({
      metric: "profit",
      points: [{ period: "2025-01-01", value: 6 }],
      total: 60,
    });
    expect(Object.keys(result)).toEqual(ALL);
  });

  it("lo que ya está en caché no se vuelve a pedir", async () => {
    await fetchReportingSalesSeries(month(1), "day", ["revenue", "count"]);
    await fetchReportingSalesSeries(month(1), "day", ["revenue", "count"]);
    await fetchReportingSalesSeries(month(1), "day", ["revenue", "profit"]);

    expect(historyBatch).toHaveBeenCalledTimes(2);
    expect(historyBatch.mock.calls[1][0].metrics).toEqual(["profit"]);
  });

  it("dos gráficos a la vez reusan el pedido en vuelo y solo piden lo que falta", async () => {
    const [first, second] = await Promise.all([
      fetchReportingSalesSeries(month(2), "month", ["revenue", "count"]),
      fetchReportingSalesSeries(month(2), "month", ["revenue", "avgTicket"]),
    ]);

    expect(historyBatch).toHaveBeenCalledTimes(2);
    expect(historyBatch.mock.calls[0][0].metrics).toEqual(["revenue", "count"]);
    expect(historyBatch.mock.calls[1][0].metrics).toEqual(["avgTicket"]);
    expect(second.revenue).toEqual(first.revenue);
  });

  it("si el pedido falla, se informa y el próximo intento vuelve a pedir", async () => {
    historyBatch.mockRejectedValueOnce(new Error("sin conexión"));

    await expect(
      fetchReportingSalesSeries(month(3), "day", ["revenue"])
    ).rejects.toThrow("sin conexión");
    await fetchReportingSalesSeries(month(3), "day", ["revenue"]);

    expect(historyBatch).toHaveBeenCalledTimes(2);
  });
});
