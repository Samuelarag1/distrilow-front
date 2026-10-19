import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPosCartStorageKey, countPendingPosCartItems } from "./pos-cart-storage";

// The branch selector warns before switching branch only when this count is
// above 0 (components/branchSelector/branchSelector.tsx).

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function saveCart(userId: string, branchId: string, items: number, updatedAt = Date.now()) {
  storage.set(
    buildPosCartStorageKey(userId, branchId)!,
    JSON.stringify({
      version: 1,
      updatedAt,
      userId,
      branchId,
      cart: Array.from({ length: items }, (_, n) => ({ id: `p${n}` })),
    })
  );
}

describe("countPendingPosCartItems — venta en curso antes de cambiar de sucursal", () => {
  it("sin carrito guardado da 0", () => {
    expect(countPendingPosCartItems("ana", "branch-A")).toBe(0);
  });

  it("cuenta los productos del carrito de ese usuario en esa sucursal", () => {
    saveCart("ana", "branch-A", 3);
    expect(countPendingPosCartItems("ana", "branch-A")).toBe(3);
  });

  it("el carrito de otra sucursal o de otro usuario no cuenta", () => {
    saveCart("ana", "branch-B", 2);
    saveCart("beto", "branch-A", 2);
    expect(countPendingPosCartItems("ana", "branch-A")).toBe(0);
  });

  it("un carrito vencido (mas de 12 horas) no cuenta, igual que en el POS", () => {
    saveCart("ana", "branch-A", 3, Date.now() - 13 * 60 * 60 * 1000);
    expect(countPendingPosCartItems("ana", "branch-A")).toBe(0);
  });

  it("un valor corrupto o sin usuario no rompe: da 0", () => {
    storage.set(buildPosCartStorageKey("ana", "branch-A")!, "{no es json");
    expect(countPendingPosCartItems("ana", "branch-A")).toBe(0);
    expect(countPendingPosCartItems(null, "branch-A")).toBe(0);
  });
});
