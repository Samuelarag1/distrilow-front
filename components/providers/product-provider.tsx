"use client";

import React, { createContext, useContext } from "react";
import { mutate } from "swr";
import { useAudit } from "./audit-provider";
import { useUser } from "./user-provider";
import { apiClientFetch } from "@/lib/api-client";
import { productsApi, Product } from "@/lib/products";
import { useProducts as useProductsHook } from "@/hooks/useProducts";

type MovementType =
  | "PURCHASE"
  | "SALE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT"
  | "RETURN"
  | "LOSS"
  | "EXPIRED";

interface ProductContextType {
  updateStock: (
    id: string,
    newStock: number,
    branchId?: string
  ) => Promise<void>;
  adjustStock: (id: string, delta: number, branchId?: string) => Promise<void>;
  addProduct: (product: Partial<Product>) => Promise<void>;
  updateProduct: (id: string, productData: Partial<Product>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

type StockState = {
  productId: string;
  quantity: string | number | null;
};

function getMovementType(delta: number): MovementType {
  return delta >= 0 ? "TRANSFER_IN" : "TRANSFER_OUT";
}

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const { logEvent } = useAudit();
  const { branchId: sessionBranchId } = useUser();

  const invalidateProducts = () =>
    mutate((key) => {
      if (typeof key === "string") return key.includes("/products");
      if (Array.isArray(key) && typeof key[0] === "string") {
        return key[0].includes("/products");
      }
      return false;
    });

  const resolveBranchId = (candidate?: string) => {
    const resolved = candidate || sessionBranchId || null;
    if (!resolved) {
      throw new Error("No hay sucursal activa para ajustar stock.");
    }
    return resolved;
  };

  const postStockMovement = async (
    productId: string,
    branchId: string,
    delta: number
  ) => {
    const quantity = Math.abs(Math.trunc(delta));
    if (quantity < 1) return;

    await apiClientFetch.post("/stock-movements/adjustment-in", {
      productId,
      branchId,
      quantity,
      type: getMovementType(delta),
    });
  };

  const getBranchProductStock = async (branchId: string, productId: string) => {
    const stockRows = await apiClientFetch.get<StockState[]>(
      `/stocks/branch/${branchId}`
    );

    const stockRow = stockRows.find((row) => row.productId === productId);
    const quantity = Number(stockRow?.quantity ?? 0);
    return Number.isFinite(quantity) ? quantity : 0;
  };

  const updateStock = async (
    id: string,
    newStock: number,
    branchId?: string
  ) => {
    const product = await productsApi.getById(id);
    const resolvedBranchId = resolveBranchId(branchId || product.branchId);
    const currentStock = await getBranchProductStock(resolvedBranchId, id);
    const targetStock = Math.max(0, Math.trunc(newStock));
    const delta = targetStock - currentStock;

    if (delta === 0) return;

    await postStockMovement(id, resolvedBranchId, delta);

    logEvent("adjust_stock", "product", "Actualizo stock", id, {
      branchId: resolvedBranchId,
      delta,
      newStock: targetStock,
      type: getMovementType(delta),
    });

    invalidateProducts();
    mutate(["product", id]);
  };

  const adjustStock = async (id: string, delta: number, branchId?: string) => {
    const normalizedDelta = Math.trunc(delta);
    if (normalizedDelta === 0) return;

    const product = await productsApi.getById(id);
    const resolvedBranchId = resolveBranchId(branchId || product.branchId);

    await postStockMovement(id, resolvedBranchId, normalizedDelta);

    logEvent("adjust_stock", "product", "Ajusto stock", id, {
      branchId: resolvedBranchId,
      delta: normalizedDelta,
      type: getMovementType(normalizedDelta),
    });

    invalidateProducts();
    mutate(["product", id]);
  };

  const addProduct = async (productData: Partial<Product>) => {
    const created = await productsApi.create(productData);

    logEvent("create", "product", "Agrego nuevo producto", created.id);

    invalidateProducts();
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    await productsApi.update(id, productData);

    logEvent("update", "product", "Modifico producto", id, {
      productData,
    });

    invalidateProducts();
    mutate(["product", id]);
  };

  const removeProduct = async (id: string) => {
    await productsApi.remove(id);

    logEvent("delete", "product", "Elimino producto", id);

    invalidateProducts();
  };

  return (
    <ProductContext.Provider
      value={{
        updateStock,
        adjustStock,
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
export function useProducts() {
  const swr = useProductsHook();
  const { updateStock, adjustStock } = useProductActions();

  return {
    ...swr,
    updateStock,
    adjustStock,
  };
}
