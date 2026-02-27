"use client";

import React, { createContext, useContext } from "react";
import { mutate } from "swr";
import { useAudit } from "./audit-provider";
import { productsApi, Product } from "@/lib/products";
import { useProducts as useProductsHook } from "@/hooks/useProducts";

interface ProductContextType {
  updateStock: (id: string, newStock: number) => Promise<void>;
  adjustStock: (id: string, delta: number) => Promise<void>;
  addProduct: (product: Partial<Product>) => Promise<void>;
  updateProduct: (id: string, productData: Partial<Product>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const { logEvent } = useAudit();

  const invalidateProducts = () =>
    mutate((key) => Array.isArray(key) && key[0] === "products");

  const updateStock = async (id: string, newStock: number) => {
    await productsApi.update(id, { stock: Math.max(0, newStock) });

    logEvent("adjust_stock", "product", "Actualizo stock", id, {
      newStock,
    });

    invalidateProducts();
    mutate(["product", id]);
  };

  const adjustStock = async (id: string, delta: number) => {
    const product = await productsApi.getById(id);
    const newStock = Math.max(0, product.stock + delta);

    await productsApi.update(id, { stock: newStock });

    logEvent("adjust_stock", "product", "Ajusto stock", id, {
      delta,
      newStock,
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
