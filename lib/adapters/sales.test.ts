import { describe, expect, it } from "vitest";

import { ensureSaleDetail, normalizeSale } from "./sales";

describe("sales adapter", () => {
  it("prioritizes canonical sales fields while keeping legacy fallbacks", () => {
    const sale = ensureSaleDetail(
      normalizeSale(
        {
          id: "sale-1",
          branchId: "branch-1",
          userId: "user-1",
          userName: "Ana",
          totalAmount: 1500,
          totalCost: 1000,
          profit: 500,
          paidAmount: 500,
          outstandingAmount: 1000,
          chargeStatus: "PARTIALLY_PAID",
          paymentStatus: "PAID",
          paymentType: "MIXED",
          paymentBreakdown: {
            CASH: 500,
            CREDIT_CARD: 1000,
          },
          paymentBreakdownByMethod: {
            cash: 500,
            card: 1000,
          },
          pendingReason: "Cliente paga al retirar",
          note: "Entrega parcial de prueba",
          notes: "Motivo pendiente: Legacy\nNota: no deberia ganar",
          itemsCount: 1,
          itemsQuantity: 2,
          createdAt: "2026-04-03T10:00:00.000Z",
          items: [
            {
              productId: "prod-1",
              productName: "Yerba",
              quantity: 2,
              unitPrice: 750,
              subtotal: 1500,
            },
          ],
          payments: [
            {
              id: "pay-1",
              saleId: "sale-1",
              amount: 500,
              method: "CASH",
              createdAt: "2026-04-03T10:05:00.000Z",
            },
          ],
        },
        {
          businessType: "retail",
        }
      )
    );

    expect(sale.chargeStatus).toBe("PARTIALLY_PAID");
    expect(sale.legacyChargeStatus).toBe("PAID");
    expect(sale.note).toBe("Entrega parcial de prueba");
    expect(sale.pendingReason).toBe("Cliente paga al retirar");
    expect(sale.paymentType).toBe("MIXED");
    expect(sale.paymentBreakdownByMethod.card).toBe(1000);
    expect(sale.lineItems[0]?.productName).toBe("Yerba");
  });

  it("reconstructs legacy notes and payment data safely", () => {
    const sale = ensureSaleDetail(
      normalizeSale(
        {
          id: "sale-legacy",
          branchId: "branch-1",
          total: 2000,
          paymentStatus: "PENDING",
          paymentBreakdown: {
            EFECTIVO: 500,
          },
          notes: "Motivo pendiente: Seña\nNota: llamar antes de entregar",
          createdAt: "2026-04-03T11:00:00.000Z",
          items: [
            {
              productId: "prod-2",
              quantity: 1,
              unitPrice: 2000,
            },
          ],
        },
        {
          businessType: "retail",
        }
      )
    );

    expect(sale.chargeStatus).toBe("PENDING");
    expect(sale.pendingReason).toBe("Seña");
    expect(sale.note).toBe("llamar antes de entregar");
    expect(sale.paymentType).toBe("CASH");
    expect(sale.paymentBreakdownByMethod.cash).toBe(500);
    expect(sale.notesRaw).toContain("Motivo pendiente");
  });

  it("formats technical pending reasons for the UI", () => {
    const sale = normalizeSale(
      {
        id: "sale-code",
        branchId: "branch-1",
        totalAmount: 1000,
        paidAmount: 0,
        outstandingAmount: 1000,
        chargeStatus: "PENDING",
        pendingReason: "OUTSTANDING_BALANCE",
        createdAt: "2026-04-03T11:00:00.000Z",
      },
      {
        businessType: "retail",
      }
    );

    expect(sale.pendingReason).toBe("OUTSTANDING_BALANCE");
    expect(sale.pendingReasonLabel).toBe("Saldo pendiente");
  });
});
