import { describe, expect, it } from "vitest";
import { getCashDiscountAmount } from "./cash-discount";

describe("getCashDiscountAmount", () => {
  it("calcula el 10% exacto", () => {
    expect(getCashDiscountAmount(13500)).toBe(1350);
  });

  it("redondea al centavo igual que el back", () => {
    // 10% de 1234.55 = 123.455 → 123.46
    expect(getCashDiscountAmount(1234.55)).toBe(123.46);
  });

  it("no descuenta nada sobre un total vacío o inválido", () => {
    expect(getCashDiscountAmount(0)).toBe(0);
    expect(getCashDiscountAmount(Number.NaN)).toBe(0);
  });
});
