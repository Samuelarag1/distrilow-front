import type {
  MeasurementType,
  Product,
  ReportsInventoryOverviewItem,
  StockListItem,
  StockSharedProduct,
  StockSharedRelation,
} from "../api-types";
import {
  isRecord,
  toFiniteNumber,
  toOptionalFiniteNumber,
  toOptionalText,
  toTrimmedText,
} from "./utils";

export type InventoryOverviewStatus =
  | "OUT_OF_STOCK"
  | "LOW"
  | "NORMAL"
  | "HIGH";

export interface InventoryOverviewRow {
  id: string;
  productId: string;
  productName: string;
  name: string;
  branchId: string;
  sourceBranchId?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  measurementType: MeasurementType | null;
  trackStock: boolean;
  stock: number;
  quantity: number;
  baseQuantity?: number | null;
  stockProductId?: string | null;
  stockConsumptionQuantity?: number | null;
  stockBaseUnit?: MeasurementType | null;
  minStock?: number | null;
  maxStock?: number | null;
  shortageQty?: number | null;
  stockStatus?: InventoryOverviewStatus | null;
  sharedStock: StockSharedRelation | null;
  averageCost: number;
  costPrice: number;
  retailPrice?: number | null;
  wholesalePrice?: number | null;
  updatedAt?: string | null;
  product: Partial<Product> & {
    id?: string;
    name?: string;
    stock?: number;
    minStock?: number | null;
    maxStock?: number | null;
  };
}

export interface NormalizedInventoryOverviewPage {
  items: InventoryOverviewRow[];
  total: number;
  skip: number;
  take: number;
  nextSkip: number | null;
  hasMore: boolean;
}

function normalizeMeasurementType(value: unknown): MeasurementType | null {
  if (
    value === "unit" ||
    value === "gram" ||
    value === "kg" ||
    value === "ml" ||
    value === "liter"
  ) {
    return value;
  }

  return null;
}

function normalizeSharedProduct(
  value: unknown,
  fallbackBaseUnit: MeasurementType | null
): StockSharedProduct | null {
  if (!isRecord(value)) return null;

  const id = toOptionalText(value.id);
  if (!id) return null;

  return {
    id,
    name: toOptionalText(value.name) ?? id,
    sku: toOptionalText(value.sku) ?? null,
    barcode: toOptionalText(value.barcode) ?? null,
    pluCode: toOptionalText(value.pluCode) ?? null,
    stockConsumptionQuantity:
      toOptionalFiniteNumber(value.stockConsumptionQuantity) ?? null,
    stockBaseUnit:
      normalizeMeasurementType(value.stockBaseUnit) ?? fallbackBaseUnit,
    isBase: Boolean(value.isBase),
  };
}

function normalizeSharedStock(
  value: unknown,
  fallback: {
    stockProductId?: string | null;
    productId: string;
    stockConsumptionQuantity?: number | null;
    stockBaseUnit?: MeasurementType | null;
  }
): StockSharedRelation | null {
  const stockProductId =
    toOptionalText(fallback.stockProductId) ?? fallback.productId;
  const baseUnit = normalizeMeasurementType(fallback.stockBaseUnit);

  if (isRecord(value)) {
    const linkedProducts = Array.isArray(value.linkedProducts)
      ? value.linkedProducts
          .map((item) => normalizeSharedProduct(item, baseUnit))
          .filter((item): item is StockSharedProduct => Boolean(item))
      : [];

    return {
      stockProductId,
      isShared: Boolean(value.isShared),
      linkedProductsCount: Math.max(
        0,
        Math.trunc(
          toFiniteNumber(value.linkedProductsCount, linkedProducts.length)
        )
      ),
      linkedProducts,
    };
  }

  const isShared = Boolean(
    stockProductId && fallback.productId && stockProductId !== fallback.productId
  );

  if (!isShared) return null;

  return {
    stockProductId,
    isShared: true,
    linkedProductsCount: 0,
    linkedProducts: [],
  };
}

function buildProductSnapshot(
  row: Omit<InventoryOverviewRow, "product">
): InventoryOverviewRow["product"] {
  return {
    id: row.productId || undefined,
    name: row.productName || undefined,
    branchId: row.branchId || undefined,
    categoryId: row.categoryId ?? undefined,
    categoryName: row.categoryName ?? undefined,
    measurementType: row.measurementType ?? undefined,
    trackStock: row.trackStock,
    stockBaseProductId: row.stockProductId ?? undefined,
    stockConsumptionQuantity: row.stockConsumptionQuantity ?? undefined,
    stockBaseUnit: row.stockBaseUnit ?? undefined,
    minStock: row.minStock ?? undefined,
    maxStock: row.maxStock ?? undefined,
    costPrice: row.averageCost,
    retailPrice: row.retailPrice ?? undefined,
    wholesalePrice: row.wholesalePrice ?? undefined,
    stock: row.stock,
  };
}

export function normalizeInventoryOverviewRow(
  row: ReportsInventoryOverviewItem
): InventoryOverviewRow {
  const productId = String(row.productId ?? "").trim();
  const productName = toOptionalText(row.productName) ?? productId;
  const branchId = toTrimmedText(row.branchId);
  const measurementType = normalizeMeasurementType(row.measurementType);
  const stockBaseUnit = normalizeMeasurementType(row.stockBaseUnit);
  const stockProductId = toOptionalText(row.stockProductId) ?? productId;
  const sharedStock = normalizeSharedStock(row.sharedStock, {
    stockProductId,
    productId,
    stockConsumptionQuantity: row.stockConsumptionQuantity,
    stockBaseUnit,
  });
  const normalized: Omit<InventoryOverviewRow, "product"> = {
    id: [branchId || "branch", productId || "product"].join(":"),
    productId,
    productName,
    name: productName,
    branchId,
    sourceBranchId: toOptionalText(row.sourceBranchId) ?? null,
    categoryId: toOptionalText(row.categoryId) ?? null,
    categoryName: toOptionalText(row.categoryName) ?? null,
    measurementType,
    trackStock: row.trackStock !== false,
    stock: toFiniteNumber(row.stock, 0),
    quantity: toFiniteNumber(row.stock, 0),
    baseQuantity: toOptionalFiniteNumber(row.baseQuantity) ?? null,
    stockProductId,
    stockConsumptionQuantity:
      toOptionalFiniteNumber(row.stockConsumptionQuantity) ?? null,
    stockBaseUnit,
    minStock: toOptionalFiniteNumber(row.minStock) ?? null,
    maxStock: toOptionalFiniteNumber(row.maxStock) ?? null,
    shortageQty: toOptionalFiniteNumber(row.shortageQty) ?? null,
    stockStatus:
      row.stockStatus === "OUT_OF_STOCK" ||
      row.stockStatus === "LOW" ||
      row.stockStatus === "NORMAL" ||
      row.stockStatus === "HIGH"
        ? row.stockStatus
        : null,
    sharedStock,
    averageCost: toFiniteNumber(row.averageCost, 0),
    costPrice: toFiniteNumber(row.costPrice, 0),
    retailPrice: toOptionalFiniteNumber(row.retailPrice) ?? null,
    wholesalePrice: toOptionalFiniteNumber(row.wholesalePrice) ?? null,
    updatedAt: toOptionalText(row.updatedAt) ?? null,
  };

  return {
    ...normalized,
    product: buildProductSnapshot(normalized),
  };
}

function readLegacyProductName(
  product: Partial<Product> | null | undefined,
  stockRow: Partial<StockListItem> | null | undefined
) {
  return (
    toOptionalText(stockRow?.name) ??
    toOptionalText(stockRow?.product?.name) ??
    toOptionalText(product?.name) ??
    toOptionalText(product?.id) ??
    "Producto"
  );
}

export function buildInventoryOverviewRowFromLegacy(input: {
  product?: Partial<Product> | null;
  stockRow?: Partial<StockListItem> | null;
  branchId?: string | null;
  categoryName?: string | null;
}): InventoryOverviewRow {
  const product = input.product ?? null;
  const stockRow = input.stockRow ?? null;
  const productId =
    toOptionalText(stockRow?.productId) ??
    toOptionalText(product?.id) ??
    "product";
  const productWithStock = product as
    | (Partial<Product> & { stock?: number | null })
    | null;
  const branchId =
    toOptionalText(stockRow?.branchId) ??
    toOptionalText(product?.branchId) ??
    toOptionalText(input.branchId) ??
    "";
  const measurementType =
    normalizeMeasurementType(stockRow?.product?.measurementType) ??
    normalizeMeasurementType(product?.measurementType) ??
    (Boolean(stockRow?.product?.isWeighable ?? product?.isWeighable)
      ? "kg"
      : "unit");
  const stockBaseUnit =
    normalizeMeasurementType(stockRow?.stockBaseUnit) ??
    normalizeMeasurementType(product?.stockBaseUnit) ??
    measurementType;
  const stockConsumptionQuantity = Math.max(
    toFiniteNumber(
      stockRow?.stockConsumptionQuantity ?? product?.stockConsumptionQuantity,
      1
    ),
    1
  );
  const stock = toFiniteNumber(stockRow?.quantity ?? productWithStock?.stock, 0);
  const baseQuantity =
    toOptionalFiniteNumber(stockRow?.baseQuantity) ??
    (toOptionalText(stockRow?.stockProductId ?? product?.stockBaseProductId) &&
    toOptionalText(stockRow?.stockProductId ?? product?.stockBaseProductId) !==
      productId
      ? stock * stockConsumptionQuantity
      : stock);
  const stockProductId =
    toOptionalText(stockRow?.stockProductId) ??
    toOptionalText(product?.stockBaseProductId) ??
    productId;
  const sharedStock = normalizeSharedStock(stockRow?.sharedStock, {
    stockProductId,
    productId,
    stockConsumptionQuantity,
    stockBaseUnit,
  });
  const categoryId =
    toOptionalText((stockRow?.product as Partial<Product> | undefined)?.categoryId) ??
    toOptionalText(product?.categoryId) ??
    null;
  const productWithThresholds = product as
    | (Partial<Product> & { minStock?: number | null; maxStock?: number | null })
    | null;
  const stockProductWithThresholds = stockRow?.product as
    | (Partial<Product> & { minStock?: number | null; maxStock?: number | null })
    | undefined;
  const categoryName =
    toOptionalText(input.categoryName) ??
    toOptionalText(stockProductWithThresholds?.categoryName) ??
    toOptionalText(product?.categoryName) ??
    null;
  const minStock = toOptionalFiniteNumber(
    stockProductWithThresholds?.minStock ?? productWithThresholds?.minStock
  );
  const maxStock = toOptionalFiniteNumber(
    stockProductWithThresholds?.maxStock ?? productWithThresholds?.maxStock
  );
  const productName = readLegacyProductName(product, stockRow);
  const normalized: Omit<InventoryOverviewRow, "product"> = {
    id: [branchId || "branch", productId || "product"].join(":"),
    productId,
    productName,
    name: productName,
    branchId,
    sourceBranchId: null,
    categoryId,
    categoryName,
    measurementType,
    trackStock: product?.trackStock !== false,
    stock,
    quantity: stock,
    baseQuantity: baseQuantity ?? null,
    stockProductId,
    stockConsumptionQuantity,
    stockBaseUnit,
    minStock: minStock ?? null,
    maxStock: maxStock ?? null,
    shortageQty:
      minStock !== undefined ? Math.max(0, minStock - stock) : null,
    stockStatus:
      stock <= Number.EPSILON
        ? "OUT_OF_STOCK"
        : minStock !== undefined && stock <= minStock
        ? "LOW"
        : maxStock !== undefined && stock >= maxStock
        ? "HIGH"
        : "NORMAL",
    sharedStock,
    averageCost: toFiniteNumber(stockRow?.averageCost ?? product?.costPrice, 0),
    costPrice: toFiniteNumber(product?.costPrice, 0),
    retailPrice: toOptionalFiniteNumber(product?.retailPrice) ?? null,
    wholesalePrice: toOptionalFiniteNumber(product?.wholesalePrice) ?? null,
    updatedAt: toOptionalText(stockRow?.updatedAt) ?? toOptionalText(product?.updatedAt) ?? null,
  };

  return {
    ...normalized,
    product: {
      ...product,
      ...(stockRow?.product ?? {}),
      ...buildProductSnapshot(normalized),
    },
  };
}

export function normalizeInventoryOverviewPage(
  payload: unknown,
  options?: {
    offset?: number;
    limit?: number;
  }
): NormalizedInventoryOverviewPage {
  const fallbackTake = Math.max(1, Math.trunc(toFiniteNumber(options?.limit, 20)));
  const fallbackSkip = Math.max(0, Math.trunc(toFiniteNumber(options?.offset, 0)));
  const source = isRecord(payload) ? payload : {};
  const meta = isRecord(source.meta) ? source.meta : null;
  const itemsSource = Array.isArray(source.items) ? source.items : Array.isArray(payload) ? payload : [];
  const items = itemsSource
    .map((item) =>
      normalizeInventoryOverviewRow(item as ReportsInventoryOverviewItem)
    )
    .filter((item) => Boolean(item.productId));
  const total = Math.max(
    items.length,
    Math.trunc(
      toFiniteNumber(source.total ?? meta?.total, items.length)
    )
  );
  const page = Math.max(
    1,
    Math.trunc(toFiniteNumber(source.page ?? meta?.page, 1))
  );
  const take = Math.max(
    1,
    Math.trunc(
      toFiniteNumber(source.limit ?? source.take ?? meta?.limit, fallbackTake)
    )
  );
  const skip = Math.max(
    0,
    Math.trunc(
      toFiniteNumber(
        source.offset ?? source.skip ?? meta?.offset,
        source.page || meta?.page ? (page - 1) * take : fallbackSkip
      )
    )
  );
  const hasMore = Boolean(source.hasMore ?? meta?.hasMore) || skip + take < total;

  return {
    items,
    total,
    skip,
    take,
    nextSkip: hasMore ? skip + take : null,
    hasMore,
  };
}
