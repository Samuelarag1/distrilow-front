import { describe, expect, it } from "vitest";

import {
  buildInventoryOverviewRowFromLegacy,
  normalizeInventoryOverviewRow,
} from "./inventory-overview";
import type { Product } from "../api-types";

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

  it("builds a safe legacy fallback row when overview is unavailable", () => {
    const row = buildInventoryOverviewRowFromLegacy({
      product: {
        id: "prod-2",
        name: "Harina",
        costPrice: 100,
        wholesalePrice: 130,
        retailPrice: 150,
        measurementType: "unit",
        trackStock: true,
        stock: 4,
        stockBaseProductId: "base-2",
        stockConsumptionQuantity: 2,
        stockBaseUnit: "kg",
        minStock: 5,
        maxStock: 10,
      } as Partial<Product> & {
        stock: number;
        minStock: number;
        maxStock: number;
      },
      branchId: "branch-1",
    });

    expect(row.stockStatus).toBe("LOW");
    expect(row.shortageQty).toBe(1);
    expect(row.baseQuantity).toBe(8);
    expect(row.sharedStock?.isShared).toBe(true);
    expect(row.product.stock).toBe(4);
  });
});
