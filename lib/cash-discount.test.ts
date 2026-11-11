import { describe, expect, it } from "vitest";
import { getCashDiscountAmount, resolveCashDiscount } from "./cash-discount";

describe("getCashDiscountAmount", () => {
  it("calcula el 10% cuando el neto ya da pesos enteros", () => {
    expect(getCashDiscountAmount(13500)).toBe(1350);
  });

  it("el neto sube al peso entero: los centavos quedan como ganancia", () => {
    // 1236 - 10% = 1112.40 → se cobran 1113
    expect(getCashDiscountAmount(1236)).toBe(123);
    // 1234.55 - 10% = 1111.095 → se cobran 1112
    expect(getCashDiscountAmount(1234.55)).toBe(122.55);
  });

  it.each([1230, 1231, 1232, 1233, 1234, 1235, 1236, 1237, 1238, 1239])(
    "con un total de %i el neto es un peso entero, sin bajar de lo que da el 10",
    (total) => {
      const net = total - getCashDiscountAmount(total);
      expect(Number.isInteger(net)).toBe(true);
      expect(net).toBeGreaterThanOrEqual(total * 0.9);
      expect(net - total * 0.9).toBeLessThan(1);
    }
  );

  it("nunca sube el precio: en totales mínimos el descuento queda en cero", () => {
    expect(getCashDiscountAmount(0.5)).toBe(0);
    expect(getCashDiscountAmount(1)).toBe(0);
  });

  it("no descuenta nada sobre un total vacío o inválido", () => {
    expect(getCashDiscountAmount(0)).toBe(0);
    expect(getCashDiscountAmount(Number.NaN)).toBe(0);
  });
});

describe("resolveCashDiscount (el switch arranca apagado; prendido a mano)", () => {
  it("prendido y todo en efectivo: se aplica", () => {
    expect(
      resolveCashDiscount({ enabled: true, transferAmount: 0, waivedForBalance: false })
    ).toEqual({ applied: true, block: null });
  });

  it("con una transferencia deja de aplicarse, y vuelve si se borra", () => {
    expect(
      resolveCashDiscount({ enabled: true, transferAmount: 500, waivedForBalance: false })
    ).toEqual({ applied: false, block: "transfer" });
    expect(
      resolveCashDiscount({ enabled: true, transferAmount: 0, waivedForBalance: false })
    ).toEqual({ applied: true, block: null });
  });

  it("si al cobrar queda saldo pendiente, se cobra sin descuento", () => {
    expect(
      resolveCashDiscount({ enabled: true, transferAmount: 0, waivedForBalance: true })
    ).toEqual({ applied: false, block: "balance" });
  });

  it("apagado por el cajero: no se aplica y no hay aviso", () => {
    expect(
      resolveCashDiscount({ enabled: false, transferAmount: 500, waivedForBalance: true })
    ).toEqual({ applied: false, block: null });
  });
});
