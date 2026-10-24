import { describe, expect, it } from "vitest";

import { normalizeInventoryOverviewRow } from "./inventory-overview";

describe("inventory overview adapter", () => {
  it("preserves canonical inventory overview values without recalculating backend fields", () => {
    const row = normalizeInventoryOverviewRow({
      productId: "prod-1",
      productName: "Arroz",
      branchId: "branch-1",
      categoryId: "cat-1",
      categoryName: "Almacen",
      measurementType: "unit",
      trackStock: true,
      stock: 2,
      baseQuantity: 10,
      stockProductId: "base-1",
      stockConsumptionQuantity: 5,
      stockBaseUnit: "kg",
      minStock: 5,
      maxStock: null,
      shortageQty: 3,
      stockStatus: "LOW",
      sharedStock: {
        stockProductId: "base-1",
        isShared: true,
        linkedProductsCount: 2,
        linkedProducts: [],
      },
      averageCost: 200,
      retailPrice: 320,
      wholesalePrice: 280,
      updatedAt: "2026-04-03T12:00:00.000Z",
    });

    expect(row.quantity).toBe(2);
    expect(row.stockStatus).toBe("LOW");
    expect(row.shortageQty).toBe(3);
    expect(row.maxStock).toBeNull();
    expect(row.sharedStock?.isShared).toBe(true);
    expect(row.product.name).toBe("Arroz");
  });
});
