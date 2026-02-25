"use client";

import { mutate } from "swr";
import { productsApi, Product } from "@/lib/products";

export function useProductMutations() {
  const createProduct = async (data: Partial<Product>) => {
    const created = await productsApi.create(data);
    mutate((key) => Array.isArray(key) && key[0] === "products");
    return created;
  };

  const updateProduct = async (id: string, data: Partial<Product>) => {
    const updated = await productsApi.update(id, data);
    mutate(["product", id]);
    mutate((key) => Array.isArray(key) && key[0] === "products");
    return updated;
  };

  const deleteProduct = async (id: string) => {
    await productsApi.remove(id);
    mutate((key) => Array.isArray(key) && key[0] === "products");
  };

  return {
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
