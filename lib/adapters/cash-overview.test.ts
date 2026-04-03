import { describe, expect, it } from "vitest";

import {
  buildCashOverviewFromLegacyDailyBook,
  buildCashOverviewFromLegacyMonthly,
  normalizeCashOverviewResponse,
} from "./cash-overview";

describe("cash overview adapter", () => {
  it("normalizes canonical cash overview rows", () => {
    const result = normalizeCashOverviewResponse(
      {
        groupBy: "day",
        items: [
          {
            date: "2026-04-03",
            cashSales: 1000,
            transferSales: 500,
            salesTotal: 1500,
            manualIncome: 200,
            cashPurchases: 150,
            withdrawalsGross: 300,
            withdrawalsNet: 150,
            netTotal: 1400,
            countedCash: 900,
            expectedCash: 920,
            difference: -20,
            source: {
              unclassifiedOutflow: 0,
              outflowClassificationStatus: "CLASSIFIED",
            },
          },
        ],
      },
      {
        from: "2026-04-03",
        to: "2026-04-03",
        groupBy: "day",
      }
    );

    expect(result.items[0]?.salesTotal).toBe(1500);
    expect(result.items[0]?.withdrawalsNet).toBe(150);
    expect(result.items[0]?.netTotal).toBe(1400);
    expect(result.items[0]?.difference).toBe(-20);
  });

  it("marks monthly legacy outflows as unclassified instead of inventing labels", () => {
    const result = buildCashOverviewFromLegacyMonthly(
      {
        range: {
          fromMonth: "2026-04",
          toMonth: "2026-04",
        },
        filters: {},
        items: [
          {
            month: "2026-04",
            openingFloatTotal: 0,
            cashFromSales: 1000,
            transferFromSales: 500,
            manualIn: 200,
            manualOut: 300,
            expectedCashClose: 1100,
            countedCashClose: 1080,
            difference: -20,
            sessionsCount: 3,
            daysWithClose: 2,
            avgDifference: -10,
          },
        ],
      },
      {
        from: "2026-04-01",
        to: "2026-04-30",
      }
    );

    expect(result.items[0]?.unclassifiedOutflow).toBe(300);
    expect(result.items[0]?.outflowClassificationStatus).toBe(
      "LEGACY_UNCLASSIFIED"
    );
    expect(result.items[0]?.withdrawalsNet).toBe(0);
  });

  it("reconstructs daily legacy purchases heuristically when only the raw book exists", () => {
    const result = buildCashOverviewFromLegacyDailyBook(
      {
        date: "2026-04-03",
        branchId: "branch-1",
        summary: {
          openingFloat: 0,
          expectedCash: 800,
          countedCash: 780,
          difference: -20,
          movementBalance: 0,
          income: {
            cashFromPayments: 600,
            transferFromPayments: 300,
            movementIn: 100,
          },
          outflow: {
            movementOut: 250,
          },
        },
        sessions: [],
        entries: [
          {
            id: "entry-1",
            sourceType: "MANUAL",
            direction: "OUT",
            amount: 50,
            notes: "Compra con caja - reposicion",
          },
        ],
        meta: {
          total: 1,
          offset: 0,
          limit: 20,
          hasMore: false,
        },
      },
      "day"
    );

    expect(result.items[0]?.cashPurchases).toBe(50);
    expect(result.items[0]?.withdrawalsNet).toBe(200);
    expect(result.items[0]?.outflowClassificationStatus).toBe(
      "LEGACY_HEURISTIC"
    );
  });
});
