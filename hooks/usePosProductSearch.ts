"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";

import type { Product } from "@/lib/products";
import { backendApi } from "@/lib/backend-api";
import { subscribeProductsSync } from "@/lib/products-live-sync";

export const POS_MIN_SEARCH_LENGTH = 2;

type UsePosProductSearchArgs = {
  branchId?: string | null;
  query: string;
  take?: number;
  enabled?: boolean;
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickFirstFinite(values: unknown[], fallback = 0) {
  for (const value of values) {
    const parsed = toFiniteNumber(value, Number.NaN);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function normalizePosProduct(
  item: Partial<Product> & { id: string; name: string }
): Product {
  const measurementType =
    item.measurementType === "kg" ||
    item.measurementType === "gram" ||
    item.measurementType === "unit"
      ? item.measurementType
      : "unit";

  const parsedStock = Number(item.stock);

  return {
    ...item,
    id: item.id,
    sku: item.sku ?? item.id,
    name: item.name,
    costPrice: toFiniteNumber(item.costPrice, 0),
    wholesalePrice: toFiniteNumber(item.wholesalePrice, 0),
    retailPrice: toFiniteNumber(item.retailPrice, 0),
    measurementType,
    isWeighable: item.isWeighable ?? (measurementType === "kg" || measurementType === "gram"),
    stock: Number.isFinite(parsedStock) ? parsedStock : Number.NaN,
    price: pickFirstFinite(
      [item.retailPrice, item.wholesalePrice, item.costPrice],
      0
    ),
    category:
      typeof item.category === "string" && item.category.trim()
        ? item.category
        : typeof item.categoryId === "string" && item.categoryId.trim()
        ? item.categoryId
        : "Sin categoria",
    unit: measurementType,
  };
}

export function usePosProductSearch({
  branchId,
  query,
  take = 8,
  enabled = true,
}: UsePosProductSearchArgs) {
  const lastSyncAtRef = useRef(0);
  const normalizedQuery = query.trim();
  const canSearch = normalizedQuery.length >= POS_MIN_SEARCH_LENGTH;
  const shouldFetch = Boolean(enabled && branchId && canSearch);
  const safeTake = Math.max(1, Math.min(12, Math.trunc(take) || 8));

  const { data, error, isLoading, mutate } = useSWR<Product[]>(
    shouldFetch
      ? ([
          "pos-product-search",
          branchId,
          normalizedQuery.toLowerCase(),
          safeTake,
        ] as const)
      : null,
    async () => {
      const payload = await backendApi.products.list(
        {
          skip: 0,
          take: safeTake,
          q: normalizedQuery,
          search: normalizedQuery,
          name: normalizedQuery,
          sortBy: "name",
          sortOrder: "asc",
        },
        branchId
      );

      return payload.items.map((item) =>
        normalizePosProduct(item as Product & { id: string; name: string })
      );
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 15_000,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );

  useEffect(() => {
    if (!branchId || !shouldFetch) return;

    return subscribeProductsSync((payload) => {
      if (payload.branchId && payload.branchId !== branchId) return;
      const now = Date.now();
      if (now - lastSyncAtRef.current < 700) return;
      lastSyncAtRef.current = now;
      void mutate();
    });
  }, [branchId, shouldFetch, mutate]);

  return {
    products: data ?? [],
    isLoading: shouldFetch && isLoading,
    isError: error,
    canSearch,
    mutateProducts: mutate,
  };
}
