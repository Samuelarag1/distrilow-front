// Descuento por pago en efectivo, elegido desde la caja (components/modules/pos-module.tsx).
// La regla es del back (CASH_PAYMENT_DISCOUNT_PERCENT en src/modules/sales/domain/cash-discount.ts):
// calcula el monto real, lo reparte por renglón y rechaza la venta si el porcentaje que
// manda el front no coincide con el vigente. Si cambia allá, cambiarlo acá.
export const CASH_PAYMENT_DISCOUNT_PERCENT = 10;

/** Mismo redondeo que el back: el descuento sobre el total en centavos, al centavo. */
export function getCashDiscountAmount(total: number): number {
  const totalCents = Math.round(total * 100);
  if (!Number.isFinite(totalCents) || totalCents <= 0) return 0;
  return Math.round((totalCents * CASH_PAYMENT_DISCOUNT_PERCENT) / 100) / 100;
}
