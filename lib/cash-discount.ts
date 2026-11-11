// Descuento por pago en efectivo, elegido desde la caja (components/modules/pos-module.tsx).
// La regla es del back (CASH_PAYMENT_DISCOUNT_PERCENT en src/modules/sales/domain/cash-discount.ts):
// calcula el monto real, lo reparte por renglón y rechaza la venta si el porcentaje que
// manda el front no coincide con el vigente. Si cambia allá, cambiarlo acá.
export const CASH_PAYMENT_DISCOUNT_PERCENT = 10;

/**
 * Mismo cálculo que el back. El efectivo se mueve en pesos enteros: no hay centavos para
 * cobrar ni para dar de vuelto, así que el neto sube al peso entero y esos centavos quedan
 * como ganancia. Si el redondeo superara el total, no hay descuento: nunca sube el precio.
 */
export function getCashDiscountAmount(total: number): number {
  const totalCents = Math.round(total * 100);
  if (!Number.isFinite(totalCents) || totalCents <= 0) return 0;
  const netPesos = Math.ceil(
    (totalCents * (100 - CASH_PAYMENT_DISCOUNT_PERCENT)) / 10_000
  );
  return Math.max(0, totalCents - netPesos * 100) / 100;
}

export type CashDiscountBlock = "transfer" | "balance";

/**
 * El switch arranca apagado (decisión del 2026-11-11) y el cajero lo prende a mano; aun prendido,
 * el descuento solo se aplica si toda la venta se cobra en efectivo, como exige el back. Si el cajero carga una
 * transferencia, deja de aplicarse al instante; si borra la transferencia, vuelve. El saldo
 * pendiente se decide al tocar "Cobrar" (`waivedForBalance`), no mientras se tipea el
 * efectivo, para que el total no salte con cada número.
 */
export function resolveCashDiscount(input: {
  enabled: boolean;
  transferAmount: number;
  waivedForBalance: boolean;
}): { applied: boolean; block: CashDiscountBlock | null } {
  if (!input.enabled) return { applied: false, block: null };
  if (Number.isFinite(input.transferAmount) && input.transferAmount > 0) {
    return { applied: false, block: "transfer" };
  }
  if (input.waivedForBalance) return { applied: false, block: "balance" };
  return { applied: true, block: null };
}

export const CASH_DISCOUNT_BLOCK_NOTICE: Record<CashDiscountBlock, string> = {
  transfer:
    "Sin descuento: hay un pago por transferencia. Se cobra a precio de lista.",
  balance:
    "Sin descuento: queda saldo pendiente. Se cobra a precio de lista.",
};
