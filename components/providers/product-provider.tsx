"use client";

import React, { createContext, useContext } from "react";
import { mutate } from "swr";
import { useAudit } from "./audit-provider";
import { useUser } from "./user-provider";
import { backendApi } from "@/lib/backend-api";
import { productsApi, Product } from "@/lib/products";
import { emitProductsSync } from "@/lib/products-live-sync";
import {
  useProducts as useProductsHook,
  type UseProductsArgs,
} from "@/hooks/useProducts";
import type { CreateMovementRequest, MovementType } from "@/lib/api-types";

interface StockMovementInput {
  productId: string;
  quantity: number;
  type: MovementType;
  branchId?: string;
  unitCost?: number;
  reason?: string;
  toBranchId?: string;
  direction?: "in" | "out";
}

interface ProductContextType {
  updateStock: (
    id: string,
    newStock: number,
    branchId?: string
  ) => Promise<void>;
  adjustStock: (
    id: string,
    delta: number,
    branchId?: string,
    options?: { type?: MovementType; reason?: string }
  ) => Promise<void>;
  registerStockMovement: (input: StockMovementInput) => Promise<void>;
  transferStock: (
    productId: string,
    quantity: number,
    toBranchId: string,
    fromBranchId?: string,
    reason?: string
  ) => Promise<void>;
  addProduct: (product: Partial<Product>) => Promise<Product>;
  updateProduct: (
    id: string,
    productData: Partial<Product>
  ) => Promise<Product | null>;
  removeProduct: (id: string) => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

type StockState = {
  productId: string;
  quantity: string | number | null;
};

const INBOUND_TYPES = new Set<MovementType>([
  "PURCHASE",
  "RETURN",
  "TRANSFER_IN",
  "ADJUSTMENT",
]);

const OUTBOUND_TYPES = new Set<MovementType>([
  "SALE",
  "TRANSFER_OUT",
  "LOSS",
  "EXPIRED",
]);

type ProductUiCacheEntry = Partial<Product> & {
  id?: string;
  category?: string;
  unit?: string;
};

function normalizeProductForUi<T extends ProductUiCacheEntry>(item: T) {
  const retail = Number(item.retailPrice ?? NaN);
  const cost = Number(item.costPrice ?? NaN);
  const price = Number.isFinite(retail)
    ? retail
    : Number.isFinite(cost)
    ? cost
    : 0;

  return {
    ...item,
    price,
    category: item.categoryId ?? item.category ?? "Sin categoria",
    unit: item.measurementType ?? item.unit ?? "unit",
  };
}

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const { logEvent } = useAudit();
  const { branchId: sessionBranchId } = useUser();

  const invalidateProducts = () =>
    mutate(
      (key) => {
        if (typeof key === "string") {
          return key === "products" || key.startsWith("products") || key.includes("/products");
        }
        if (Array.isArray(key) && typeof key[0] === "string") {
          return (
            key[0] === "products" ||
            key[0] === "product" ||
            key[0].startsWith("products") ||
            key[0].includes("/products")
          );
        }
        return false;
      },
      undefined,
      { revalidate: true }
    );

  const patchProductInProductsCaches = (product: Product) =>
    mutate(
      (key) =>
        Array.isArray(key) && typeof key[0] === "string" && key[0] === "products",
      (current: unknown) => {
        const page = current as
          | { items?: ProductUiCacheEntry[]; total?: number }
          | undefined;
        if (!page || !Array.isArray(page.items)) return current;

        let changed = false;
        const nextItems = page.items.map((item) => {
          if (String(item?.id ?? "") !== product.id) return item;
          changed = true;
          return normalizeProductForUi({ ...item, ...product });
        });

        return changed ? { ...page, items: nextItems } : current;
      },
      { revalidate: false }
    );

  const removeProductFromProductsCaches = (productId: string) =>
    mutate(
      (key) =>
        Array.isArray(key) && typeof key[0] === "string" && key[0] === "products",
      (current: unknown) => {
        const page = current as
          | { items?: ProductUiCacheEntry[]; total?: number }
          | undefined;
        if (!page || !Array.isArray(page.items)) return current;
        const nextItems = page.items.filter(
          (item) => String(item?.id ?? "") !== productId
        );
        if (nextItems.length === page.items.length) return current;

        const nextTotal = Number(page.total ?? nextItems.length);
        return {
          ...page,
          items: nextItems,
          total: Math.max(0, nextTotal - 1),
        };
      },
      { revalidate: false }
    );

  const resolveBranchId = (candidate?: string) => {
    const resolved = candidate || sessionBranchId || null;
    if (!resolved) {
      throw new Error("No hay sucursal activa para ajustar stock.");
    }
    return resolved;
  };

  const getBranchProductStock = async (branchId: string, productId: string) => {
    const stockRows = (await backendApi.stocks.listByBranch(branchId)) as StockState[];

    const stockRow = stockRows.find((row) => row.productId === productId);
    const quantity = Number(stockRow?.quantity ?? 0);
    return Number.isFinite(quantity) ? quantity : 0;
  };

  const postAdjustmentMovement = async (params: {
    branchId: string;
    productId: string;
    quantity: number;
    type: MovementType;
    unitCost?: number;
    reason?: string;
    direction: "in" | "out";
  }) => {
    const payload: CreateMovementRequest = {
      branchId: params.branchId,
      productId: params.productId,
      quantity: params.quantity,
      type: params.type,
      unitCost: params.unitCost,
      reason: params.reason,
    };

    if (params.direction === "in") {
      await backendApi.stockMovements.adjustmentIn(payload);
      return;
    }

    await backendApi.stockMovements.adjustmentOut(payload);
  };

  const registerStockMovement = async (input: StockMovementInput) => {
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error("La cantidad debe ser mayor a cero.");
    }
    const normalizedQuantity = Math.round(Math.abs(quantity) * 1000) / 1000;
    const parsedUnitCost =
      input.unitCost === undefined ? undefined : Number(input.unitCost);
    const unitCost =
      parsedUnitCost !== undefined && Number.isFinite(parsedUnitCost)
        ? Math.round(Math.abs(parsedUnitCost) * 100) / 100
        : undefined;

    const branchId = resolveBranchId(input.branchId);

    if (input.type === "TRANSFER_OUT") {
      if (!input.toBranchId) {
        throw new Error("Debes seleccionar una sucursal de destino.");
      }
      if (input.toBranchId === branchId) {
        throw new Error("La sucursal destino debe ser distinta a la actual.");
      }

      await backendApi.stockMovements.transfer({
        productId: input.productId,
        fromBranchId: branchId,
        toBranchId: input.toBranchId,
        quantity: normalizedQuantity,
      });
    } else if (input.type === "ADJUSTMENT") {
      const direction = input.direction ?? "in";
      await postAdjustmentMovement({
        branchId,
        productId: input.productId,
        quantity: normalizedQuantity,
        type: "ADJUSTMENT",
        unitCost,
        reason: input.reason,
        direction,
      });
    } else if (OUTBOUND_TYPES.has(input.type)) {
      await postAdjustmentMovement({
        branchId,
        productId: input.productId,
        quantity: normalizedQuantity,
        type: input.type,
        unitCost,
        reason: input.reason,
        direction: "out",
      });
    } else if (INBOUND_TYPES.has(input.type)) {
      await postAdjustmentMovement({
        branchId,
        productId: input.productId,
        quantity: normalizedQuantity,
        type: input.type,
        unitCost,
        reason: input.reason,
        direction: "in",
      });
    } else {
      await backendApi.stockMovements.create({
        branchId,
        productId: input.productId,
        quantity: normalizedQuantity,
        type: input.type,
        unitCost,
        reason: input.reason,
      });
    }

    logEvent("adjust_stock", "product", "Movimiento de stock", input.productId, {
      branchId,
      quantity: normalizedQuantity,
      unitCost,
      movementType: input.type,
      direction: input.direction,
      toBranchId: input.toBranchId,
      reason: input.reason,
    });

    await Promise.all([
      invalidateProducts(),
      mutate(["product", input.productId], undefined, { revalidate: true }),
    ]);

    emitProductsSync(branchId);
    if (input.type === "TRANSFER_OUT" && input.toBranchId) {
      emitProductsSync(input.toBranchId);
    }
  };

  const updateStock = async (
    id: string,
    newStock: number,
    branchId?: string
  ) => {
    const product = await productsApi.getById(id);
    const resolvedBranchId = resolveBranchId(branchId || product.branchId || undefined);
    const currentStock = await getBranchProductStock(resolvedBranchId, id);
    const targetStock = Math.max(0, Math.trunc(newStock));
    const delta = targetStock - currentStock;

    if (delta === 0) return;

    await registerStockMovement({
      productId: id,
      branchId: resolvedBranchId,
      quantity: Math.abs(delta),
      type: "ADJUSTMENT",
      unitCost: Number(product.costPrice ?? 0),
      direction: delta > 0 ? "in" : "out",
      reason: "Ajuste manual de stock",
    });
  };

  const adjustStock = async (
    id: string,
    delta: number,
    branchId?: string,
    options?: { type?: MovementType; reason?: string }
  ) => {
    const normalizedDelta = Math.trunc(delta);
    if (normalizedDelta === 0) return;

    const product = await productsApi.getById(id);
    const resolvedBranchId = resolveBranchId(branchId || product.branchId || undefined);

    const movementType = options?.type ?? "ADJUSTMENT";

    await registerStockMovement({
      productId: id,
      branchId: resolvedBranchId,
      quantity: Math.abs(normalizedDelta),
      type: movementType,
      unitCost: Number(product.costPrice ?? 0),
      direction:
        movementType === "ADJUSTMENT"
          ? normalizedDelta > 0
            ? "in"
            : "out"
          : undefined,
      reason: options?.reason,
    });
  };

  const transferStock = async (
    productId: string,
    quantity: number,
    toBranchId: string,
    fromBranchId?: string,
    reason?: string
  ) => {
    await registerStockMovement({
      productId,
      quantity,
      type: "TRANSFER_OUT",
      branchId: fromBranchId,
      toBranchId,
      reason,
    });
  };

  const addProduct = async (productData: Partial<Product>) => {
    const created = await productsApi.create(productData);

    logEvent("create", "product", "Agrego nuevo producto", created.id);

    await mutate(["product", created.id], normalizeProductForUi(created), {
      revalidate: false,
    });
    await invalidateProducts();

    return created;
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    const updated = await productsApi.update(id, productData);

    if (updated) {
      logEvent("update", "product", "Modifico producto", id, {
        productData,
      });

      await Promise.all([
        patchProductInProductsCaches(updated),
        mutate(["product", id], normalizeProductForUi(updated), {
          revalidate: false,
        }),
      ]);
    }

    await Promise.all([
      invalidateProducts(),
      mutate(["product", id], undefined, { revalidate: true }),
    ]);

    return updated;
  };

  const removeProduct = async (id: string) => {
    await productsApi.remove(id);

    logEvent("delete", "product", "Elimino producto", id);

    await Promise.all([
      removeProductFromProductsCaches(id),
      mutate(["product", id], undefined, { revalidate: false }),
    ]);
    await invalidateProducts();
  };

  return (
    <ProductContext.Provider
      value={{
        updateStock,
        adjustStock,
        registerStockMovement,
        transferStock,
        addProduct,
        updateProduct,
        removeProduct,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProductActions() {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProductActions must be used within ProductProvider");
  }
  return context;
}

// Backward-compatible API for modules that still import `useProducts` from this provider.
export function useProducts(options: UseProductsArgs = {}) {
  const { branchId } = useUser();
  const swr = useProductsHook({
    ...options,
    branchId: options.branchId ?? branchId,
  });
  const { updateStock, adjustStock, registerStockMovement, transferStock } =
    useProductActions();

  return {
    ...swr,
    updateStock,
    adjustStock,
    registerStockMovement,
    transferStock,
  };
}
