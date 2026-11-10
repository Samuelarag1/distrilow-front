import { describe, expect, it } from "vitest";

import {
  extractSnapshotDateKey,
  formatSnapshotRangeLabel,
} from "./snapshot-metrics";

describe("snapshot-metrics", () => {
  it("reads the dashboard range in Argentina time, not UTC", () => {
    // Rango mensual que arma el back el 30/10: del 01/10 00:00 al 30/10 23:59:59.999 (UTC-3).
    const range = {
      from: "2026-10-01T03:00:00.000Z",
      to: "2026-10-31T02:59:59.999Z",
    };

    expect(formatSnapshotRangeLabel(range)).toBe("01/10/2026 al 30/10/2026");
  });

  it("keeps plain dates and zone-less timestamps as written", () => {
    expect(extractSnapshotDateKey("2026-10-31")).toBe("2026-10-31");
    expect(extractSnapshotDateKey("2026-10-31T00:00:00")).toBe("2026-10-31");
  });
});
