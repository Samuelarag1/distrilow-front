"use client";

import React, { createContext, useContext } from "react";
import { mutate } from "swr";
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
  const { branchId: sessionBranchId } = useUser();

  const invalidateProducts = () =>
    mutate(
      (key) => {
        const isProductOrStockKey = (value: string) => {
          const normalized = value.toLowerCase();
          return (
            normalized === "products" ||
            normalized === "product" ||
            normalized === "productdetail" ||
            normalized === "stockbyproduct" ||
            normalized === "stockmovements" ||
            normalized === "reporting-stock-discounts" ||
            normalized.startsWith("products") ||
            normalized.startsWith("stock") ||
            normalized.startsWith("stock-") ||
            normalized.includes("/products") ||
            normalized.includes("/stocks") ||
            normalized.includes("/stock-movements")
          );
        };

        if (typeof key === "string") {
          return isProductOrStockKey(key);
        }
        if (Array.isArray(key) && typeof key[0] === "string") {
          return isProductOrStockKey(key[0]);
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

    await Promise.all([
      invalidateProducts(),
      mutate(["product", input.productId], undefined, { revalidate: true }),
    ]);

    emitProductsSync(branchId);
    if (input.type === "TRANSFER_OUT" && input.toBranchId) {
      emitProductsSync(input.toBranchId);
    }
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

    await mutate(["product", created.id], normalizeProductForUi(created), {
      revalidate: false,
    });
    await invalidateProducts();

    return created;
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    const updated = await productsApi.update(id, productData);

    if (updated) {
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

    await Promise.all([
      removeProductFromProductsCaches(id),
      mutate(["product", id], undefined, { revalidate: false }),
    ]);
    await invalidateProducts();
  };

  return (
    <ProductContext.Provider
      value={{
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
  const { registerStockMovement, transferStock } = useProductActions();

  return {
    ...swr,
    registerStockMovement,
    transferStock,
  };
}
