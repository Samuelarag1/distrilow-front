import { describe, expect, it } from "vitest";

import {
  buildMonthlySalesBreakdownRows,
  createMonthSelection,
  formatMonthInputValue,
  parseMonthInputValue,
} from "./month-selection";

describe("month-selection", () => {
  it("parses and formats month input values", () => {
    const parsed = parseMonthInputValue("2026-04");

    expect(parsed).not.toBeNull();
    expect(formatMonthInputValue(parsed as Date)).toBe("2026-04");
  });

  it("normalizes reversed month ranges safely", () => {
    const selection = createMonthSelection(
      new Date(2026, 0, 10),
      new Date(2026, 3, 18),
      {
        fromMonth: "2026-05",
        toMonth: "2026-03",
      }
    );

    expect(selection.fromMonth).toBe("2026-03");
    expect(selection.toMonth).toBe("2026-05");
    expect(selection.fromYmd).toBe("2026-03-01");
    expect(selection.toYmd).toBe("2026-05-31");
  });

  it("builds monthly rows with average ticket", () => {
    const rows = buildMonthlySalesBreakdownRows(
      [
        { period: "2026-01", value: 150000 },
        { period: "2026-02", value: 90000 },
      ],
      [
        { period: "2026-01", value: 10 },
        { period: "2026-02", value: 6 },
      ]
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      period: "2026-01",
      revenue: 150000,
      orders: 10,
      avgTicket: 15000,
    });
    expect(rows[1]).toMatchObject({
      period: "2026-02",
      revenue: 90000,
      orders: 6,
      avgTicket: 15000,
    });
  });
});
