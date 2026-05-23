"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { backendApi } from "@/lib/backend-api";
import type { MeasurementType } from "@/lib/api-types";
import type { Product } from "@/lib/products";
import { resolveStockReference } from "@/lib/stock-reference";

export type StockMode = "own" | "shared";

export type ProductStockLinkingValues = {
  trackStock: boolean;
  useSharedStock: boolean;
  stockBaseProductId: string;
  stockConsumptionQuantity: number | "";
  stockBaseUnit: MeasurementType | string;
};

export type StockBaseOption = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  pluCode?: string | null;
};

export function mapProductStockLinkingBackendError(error: unknown) {
  const normalize = (value: unknown) => String(value ?? "").toLowerCase();
  const details =
    (error as any)?.response?.data?.details ??
    (error as any)?.details ??
    (error as any)?.response?.data?.message ??
    (error as any)?.message ??
    "No se pudo actualizar la configuracion de stock.";
  const text = normalize(Array.isArray(details) ? details.join(" | ") : details);

  if (
    text.includes("self-link") ||
    text.includes("self link") ||
    text.includes("self_link") ||
    (text.includes("stockbaseproductid") &&
      text.includes("equal") &&
      text.includes("id"))
  ) {
    return "Relacion de stock invalida: el producto no puede autoreferenciarse de forma incorrecta.";
  }
  if (
    (text.includes("base") && text.includes("not found")) ||
    text.includes("stock base no encontrado") ||
    text.includes("base no encontrado")
  ) {
    return "El producto base de stock no existe.";
  }
  if (
    (text.includes("base") && text.includes("inactive")) ||
    text.includes("base inactivo")
  ) {
    return "El producto base esta inactivo y no puede usarse.";
  }
  if (
    text.includes("base") &&
    (text.includes("track stock") ||
      text.includes("trackstock") ||
      text.includes("no trackea stock") ||
      text.includes("no controla stock"))
  ) {
    return "El producto base seleccionado no controla stock.";
  }
  if (
    text.includes("base") &&
    (text.includes("depends on another") ||
      text.includes("already depends") ||
      text.includes("ya depende de otro"))
  ) {
    return "El producto base seleccionado ya depende de otro stock base.";
  }
  if (
    (text.includes("stockbaseunit") && text.includes("incompatible")) ||
    (text.includes("unidad base") && text.includes("incompatible"))
  ) {
    return "La unidad base de stock es incompatible con el producto base.";
  }

  return Array.isArray(details) ? details.join(" ") : String(details);
}

function toFinite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function useProductStockLinking(input: {
  product: Product | null;
  activeBranchId: string | null;
  baseSearchQuery: string;
  values: ProductStockLinkingValues;
}) {
  const [isCheckingRelation, setIsCheckingRelation] = useState(false);
  const [blockingMessage, setBlockingMessage] = useState<string | null>(null);

  const productId = String(input.product?.id ?? "").trim();
  const currentBaseId = String(
    input.product?.stockBaseProductId ?? input.product?.id ?? ""
  ).trim();
  const fallbackOwnBaseId = productId || "__self__";
  const selectedBaseIdRaw = String(input.values.stockBaseProductId ?? "").trim();
  const selectedBaseId =
    selectedBaseIdRaw && selectedBaseIdRaw !== "__self__"
      ? selectedBaseIdRaw
      : productId;
  const normalizedBaseSearch = input.baseSearchQuery.trim();
  const stockMode: StockMode =
    input.values.trackStock && input.values.useSharedStock
      ? "shared"
      : "own";

  const { data: baseProducts } = useSWR<StockBaseOption[]>(
    input.activeBranchId &&
    input.values.trackStock &&
    input.values.useSharedStock &&
    normalizedBaseSearch.length >= 2
      ? [
          "stock-link-base-products",
          input.activeBranchId,
          normalizedBaseSearch,
        ]
      : null,
    async () => {
      const page = await backendApi.products.list(
        {
          page: 1,
          limit: 20,
          search: normalizedBaseSearch,
          sortBy: "name",
          sortOrder: "asc",
        },
        input.activeBranchId
      );
      return page.items
        .filter((item) => item?.id && item?.name)
        .map((item) => ({
          id: String(item.id),
          name: String(item.name),
          sku: String(item.sku ?? "").trim() || null,
          barcode: String(item.barcode ?? "").trim() || null,
          pluCode: String(item.pluCode ?? "").trim() || null,
        }));
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const { data: selectedBaseProduct } = useSWR<
    { id: string; name: string } | null
  >(
    input.activeBranchId && selectedBaseIdRaw && selectedBaseIdRaw !== "__self__"
      ? ["stock-link-selected-base", input.activeBranchId, selectedBaseIdRaw]
      : null,
    async () => {
      const item = await backendApi.products.getById(selectedBaseIdRaw);
      return {
        id: String(item.id),
        name: String(item.name ?? "").trim() || String(item.id),
      };
    },
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      keepPreviousData: true,
    }
  );

  const baseOptions = useMemo(() => {
    const options = baseProducts ?? [];
    if (!productId) return options;
    return options.filter((option) => option.id !== productId);
  }, [baseProducts, productId]);

  const selectedBaseLabel = useMemo(() => {
    if (!selectedBaseIdRaw || selectedBaseIdRaw === "__self__") return null;
    const fromOptions = baseOptions.find((option) => option.id === selectedBaseIdRaw);
    if (fromOptions?.name) return fromOptions.name;
    if (selectedBaseProduct?.name) return selectedBaseProduct.name;
    return null;
  }, [baseOptions, selectedBaseIdRaw, selectedBaseProduct?.name]);

  const consumptionPreview = useMemo(() => {
    const qty = toFinite(input.values.stockConsumptionQuantity);
    const normalizedQty =
      Number.isFinite(qty) && qty > 0 ? qty : input.values.trackStock ? 1 : 0;
    const unit = String(input.values.stockBaseUnit ?? "").trim() || "unidad";
    return `Consume ${normalizedQty} ${unit} por unidad vendida`;
  }, [
    input.values.stockConsumptionQuantity,
    input.values.stockBaseUnit,
    input.values.trackStock,
  ]);

  const closeBlockingModal = useCallback(() => {
    setBlockingMessage(null);
  }, []);

  const buildPayload = useCallback(async () => {
    if (input.values.trackStock) {
      const parsedConsumption = toFinite(input.values.stockConsumptionQuantity);
      if (!Number.isFinite(parsedConsumption) || parsedConsumption <= 0) {
        throw new Error(
          "Si el producto trackea stock, el factor de consumo debe ser mayor a 0."
        );
      }
    }

    if (
      input.values.trackStock &&
      input.values.useSharedStock &&
      productId &&
      selectedBaseId &&
      selectedBaseId !== productId &&
      selectedBaseId !== currentBaseId
    ) {
      if (!input.activeBranchId) {
        throw new Error("Selecciona una sucursal activa para validar stock.");
      }

      setIsCheckingRelation(true);
      try {
        const currentStockReference = await resolveStockReference(
          productId,
          input.activeBranchId,
          { strict: true }
        );
        if (Number(currentStockReference.baseQuantity ?? 0) > 0) {
          setBlockingMessage(
            "Este producto tiene stock existente. Antes de relacionarlo, migrar/consolidar stock para evitar inconsistencias."
          );
          return null;
        }
      } finally {
        setIsCheckingRelation(false);
      }
    }

    const stockConsumptionQuantity = toFinite(input.values.stockConsumptionQuantity);
    const stockBaseUnit = String(input.values.stockBaseUnit ?? "").trim() as
      | MeasurementType
      | "";
    const normalizedBaseProductId =
      input.values.trackStock && input.values.useSharedStock
        ? selectedBaseIdRaw
        : input.values.trackStock
        ? selectedBaseId || (productId ? fallbackOwnBaseId : "")
      : "";

    if (
      input.values.trackStock &&
      input.values.useSharedStock &&
      (!normalizedBaseProductId || normalizedBaseProductId === "__self__")
    ) {
      throw new Error("Selecciona un producto base para stock compartido.");
    }

    return {
      trackStock: input.values.trackStock,
      stockBaseProductId:
        input.values.trackStock && normalizedBaseProductId
          ? normalizedBaseProductId === "__self__"
            ? productId || undefined
            : normalizedBaseProductId
          : undefined,
      stockConsumptionQuantity: input.values.trackStock
        ? stockConsumptionQuantity
        : undefined,
      stockBaseUnit: input.values.trackStock
        ? (stockBaseUnit || undefined)
        : undefined,
    };
  }, [
    currentBaseId,
    fallbackOwnBaseId,
    input.activeBranchId,
    input.values.useSharedStock,
    input.values.stockBaseUnit,
    input.values.stockConsumptionQuantity,
    input.values.trackStock,
    productId,
    selectedBaseId,
    selectedBaseIdRaw,
  ]);

  return {
    baseOptions,
    selectedBaseLabel,
    stockMode,
    consumptionPreview,
    isCheckingRelation,
    isLoadingBaseOptions:
      input.values.trackStock &&
      input.values.useSharedStock &&
      normalizedBaseSearch.length >= 2 &&
      !baseProducts,
    isBlockingModalOpen: Boolean(blockingMessage),
    blockingMessage,
    closeBlockingModal,
    buildPayload,
  };
}
