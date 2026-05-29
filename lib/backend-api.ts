import { ApiError, apiClientFetch, getApiSession } from "@/lib/api-client";
import { emitCashSync } from "@/lib/cash-live-sync";
import { emitExpensesSync } from "@/lib/expenses-live-sync";
import { emitProductsSync } from "@/lib/products-live-sync";
import { emitSalesSync } from "@/lib/sales-live-sync";
import type {
  AnalyticsSalesQuery,
  AnalyticsSalesResponse,
  ReportingSalesSummaryResponse,
  AuditLog,
  AuditQuery,
  AuthResponse,
  BarcodeLookupResponse,
  BootstrapBranchResponse,
  Branch,
  CashBookEntry,
  CashBookDailyQuery,
  CashBookDailyResponse,
  CashCurrentSummaryResponse,
  CashSession,
  Category,
  CloseCashSessionRequest,
  CreateBranchRequest,
  CreateCashMovementRequest,
  CreateCategoryRequest,
  CreateExpenseRequest,
  CreateMovementRequest,
  CreateProductRequest,
  CreateSaleRequest,
  CreateStockRequest,
  CreateUserRequest,
  DeleteResult,
  Expense,
  ExpenseAnalyticsResponse,
  ExpenseListQuery,
  LoginRequest,
  LogoutRequest,
  LogoutResponse,
  MeasurementType,
  Movement,
  MovementQuery,
  OffsetPaginationMeta,
  OpenCashSessionRequest,
  PaginatedResponse,
  Product,
  ProductListItem,
  PriceType,
  PricingMode,
  ProductPriceCostHistoryQuery,
  ProductPriceCostHistoryRow,
  ProductReviewPendingQuery,
  ProductsListResponse,
  ProductsQuery,
  RefreshRequest,
  ReportingGlobalMetricsResponse,
  ReportsCashMonthlyQuery,
  ReportsCashMonthlyResponse,
  ReportsCashOverviewQuery,
  ReportsCashOverviewResponse,
  ReportsExpensesProjectionQuery,
  ReportsExpensesProjectionResponse,
  ReportsInventoryLowStockQuery,
  ReportsInventoryLowStockResponse,
  ReportsInventoryOverviewQuery,
  ReportsInventoryOverviewResponse,
  ReportsProductMarginsTableQuery,
  ReportsProductMarginsTableResponse,
  ReportsInventorySummaryQuery,
  ReportsInventorySummaryResponse,
  ReportsSalesPricingSourcesSummaryQuery,
  ReportsSalesPricingSourcesSummaryResponse,
  ReportsSalesOverviewQuery,
  ReportsSalesOverviewResponse,
  ReportsSalesPriceTypesSummaryQuery,
  ReportsSalesPriceTypesSummaryResponse,
  ReportsTopProductsQuery,
  ReportsTopProductsResponse,
  SaleDetail,
  SaleListQuery,
  SalePayment,
  SaleSummary,
  SalePaymentInput,
  SalePaymentsListQuery,
  SessionResponse,
  SnapshotPeriod,
  SnapshotMetricsResponse,
  Stock,
  StockDetail,
  StockListItem,
  StockLot,
  StockLotsListQuery,
  StockLotsListResponse,
  StockSharedProduct,
  StockSharedRelation,
  StockSummaryCategoriesResponse,
  StockSummaryCategoryItem,
  StockSummaryResponse,
  StockQuery,
  SwitchBranchRequest,
  TransferMovementRequest,
  UpsertStockLotRequest,
  UpdateBranchRequest,
  UpdateCategoryRequest,
  UpdateProductRequest,
  UpdateProductReviewFlagsRequest,
  UpdateResult,
  UpdateUserBranchesRequest,
  UpdateUserRequest,
  UploadImageResponse,
  User,
  CIParetoQuery,
  CIParetoResponse,
  CISlowMoversQuery,
  CISlowMoversResponse,
  CIHourlySalesQuery,
  CIHourlySalesResponse,
  CIVelocityQuery,
  CIVelocityResponse,
  CIStockBreaksQuery,
  CIStockBreaksResponse,
  CISummaryResponse,
} from "@/lib/api-types";

export interface NormalizedProductsPage {
  items: ProductListItem[];
  total: number;
  skip: number;
  take: number;
  nextSkip: number | null;
  hasMore: boolean;
}

export interface ResolvedBarcodeProduct {
  product: ProductListItem;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  barcodeType?: "STANDARD" | "INTERNAL_EAN13";
  rawBarcode?: string;
  barcodeBase?: string;
  pluCode?: string | null;
  priceType?: PriceType;
  pricingSource?: PricingMode;
  stock?: {
    branchId: string;
    quantity: number;
    averageCost: number;
    lastPurchaseCost: number;
    updatedAt: string | null;
  };
}

export interface CashSessionSnapshotRequest {
  etag?: string | null;
  branchIdOverride?: string | null;
}

export interface CashSessionSnapshotResponse {
  status: 200 | 304;
  session: CashSession | null;
  etag: string | null;
  lastModified: string | null;
}

const STOCK_CACHE_TTL_MS = 10_000;
const stockCacheByBranch = new Map<
  string,
  { cachedAt: number; rows: Stock[] }
>();
const REPORTING_TIME_ZONE = "America/Argentina/Cordoba";
const reportingDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORTING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildQuery(
  params: object,
  options?: { preserveLimitAndOffset?: boolean }
) {
  const query = new URLSearchParams();
  const source = { ...(params as Record<string, unknown>) };
  const preserveLimitAndOffset = options?.preserveLimitAndOffset ?? false;

  if (!preserveLimitAndOffset) {
    if (source.skip === undefined && source.offset !== undefined) {
      source.skip = source.offset;
    }
    if (source.take === undefined && source.limit !== undefined) {
      source.take = source.limit;
    }
    if (source.take !== undefined) {
      source.take = Math.min(100, Math.max(1, toFiniteNumber(source.take, 20)));
    }
    delete source.offset;
    delete source.limit;
  }

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });

  const value = query.toString();
  return value ? `?${value}` : "";
}

function buildOffsetQuery(params: object) {
  const query = new URLSearchParams();
  const source = { ...(params as Record<string, unknown>) };

  const requestedLimit =
    source.limit !== undefined ? source.limit : source.take;

  if (requestedLimit !== undefined) {
    const normalizedLimit = Math.min(
      100,
      Math.max(1, toFiniteNumber(requestedLimit, 20))
    );
    source.limit = normalizedLimit;

    if (source.page === undefined) {
      const requestedOffset =
        source.offset !== undefined ? source.offset : source.skip;
      if (requestedOffset !== undefined) {
        const normalizedOffset = Math.max(
          0,
          toFiniteNumber(requestedOffset, 0)
        );
        source.page = Math.floor(normalizedOffset / normalizedLimit) + 1;
      }
    }
  }

  delete source.skip;
  delete source.take;
  delete source.offset;

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });

  const value = query.toString();
  return value ? `?${value}` : "";
}

async function getFirstAvailablePath<T>(
  paths: string[],
  options?: Parameters<typeof apiClientFetch.get<T>>[1]
) {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await apiClientFetch.get<T>(path, options);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error("No available API path");
}

function toPaginatedItemsResponse<T>(
  payload: unknown,
  fallbackOffset = 0,
  fallbackLimit = 20
): PaginatedResponse<T> {
  if (Array.isArray(payload)) {
    return toPaginatedResponse(payload, fallbackOffset, fallbackLimit);
  }

  const source =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const items = Array.isArray(source.items) ? (source.items as T[]) : [];
  const page = Math.max(1, toFiniteNumber(source.page, 1));
  const limit = Math.max(
    1,
    toFiniteNumber(source.limit ?? source.take, fallbackLimit)
  );
  const total = Math.max(items.length, toFiniteNumber(source.total, items.length));
  const offset = Math.max(
    0,
    toFiniteNumber(
      source.offset ?? source.skip,
      source.page ? (page - 1) * limit : fallbackOffset
    )
  );

  return {
    items,
    meta: normalizeOffsetMeta(
      source.meta ?? {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        page,
      },
      fallbackOffset,
      fallbackLimit,
      total
    ),
  };
}

function normalizeOffsetMeta(
  meta: unknown,
  fallbackOffset: number,
  fallbackLimit: number,
  fallbackTotal: number
): OffsetPaginationMeta {
  const parsed = (meta && typeof meta === "object" ? meta : {}) as Record<
    string,
    unknown
  >;

  const limit = Math.max(
    1,
    toFiniteNumber(parsed.limit ?? parsed.take, fallbackLimit)
  );
  const page = toFiniteNumber(parsed.page, NaN);
  const computedOffsetFromPage = Number.isFinite(page)
    ? Math.max(0, (page - 1) * limit)
    : fallbackOffset;
  const offset = Math.max(
    0,
    toFiniteNumber(parsed.offset, computedOffsetFromPage)
  );
  const total = Math.max(0, toFiniteNumber(parsed.total, fallbackTotal));
  const totalPagesValue = toFiniteNumber(parsed.totalPages, Number.NaN);
  const totalPages = Number.isFinite(totalPagesValue)
    ? Math.max(1, totalPagesValue)
    : Math.max(1, Math.ceil(total / limit));
  const hasMore =
    typeof parsed.hasMore === "boolean"
      ? parsed.hasMore
      : typeof parsed.hasNextPage === "boolean"
      ? parsed.hasNextPage
      : offset + limit < total;

  return {
    total,
    offset,
    limit,
    hasMore,
    page: Number.isFinite(page) ? page : Math.floor(offset / limit) + 1,
    totalPages,
    hasNextPage: hasMore,
    hasPreviousPage:
      typeof parsed.hasPreviousPage === "boolean"
        ? parsed.hasPreviousPage
        : offset > 0,
  };
}

function toPaginatedResponse<T>(
  payload: PaginatedResponse<T> | T[],
  fallbackOffset = 0,
  fallbackLimit = 20
): PaginatedResponse<T> {
  if (Array.isArray(payload)) {
    const items = payload;
    return {
      items,
      meta: normalizeOffsetMeta(
        { total: items.length, offset: fallbackOffset, limit: fallbackLimit },
        fallbackOffset,
        fallbackLimit,
        items.length
      ),
    };
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    items,
    meta: normalizeOffsetMeta(
      payload?.meta,
      fallbackOffset,
      fallbackLimit,
      items.length
    ),
  };
}

function normalizeProductsPage(
  payload: ProductsListResponse,
  query: ProductsQuery
): NormalizedProductsPage {
  const defaultTake = Number(query.take ?? query.limit ?? 20);
  const skip = Number(query.skip ?? query.offset ?? 0);
  const items = payload.items ?? [];

  if ("meta" in payload) {
    const meta = normalizeOffsetMeta(
      payload.meta,
      skip,
      defaultTake,
      items.length
    );
    return {
      items,
      total: meta.total,
      skip: meta.offset,
      take: meta.limit,
      nextSkip: meta.hasMore ? meta.offset + meta.limit : null,
      hasMore: meta.hasMore,
    };
  }

  const take = defaultTake;
  const hasMore = payload.pageInfo?.hasNextPage ?? items.length >= take;
  return {
    items,
    total: items.length + (hasMore ? take : 0),
    skip,
    take,
    nextSkip: hasMore ? skip + take : null,
    hasMore,
  };
}

type StockResolverContext = {
  stockByProductId: Map<string, number>;
  baseStockByStockProductId: Map<string, number>;
};

function buildStockResolverContext(stocks: Stock[]): StockResolverContext {
  const stockByProductId = new Map<string, number>();
  const baseStockByStockProductId = new Map<string, number>();

  stocks.forEach((stock) => {
    const productId = String(stock.productId ?? "").trim();
    const stockProductId = String(stock.stockProductId ?? stock.productId ?? "").trim();
    const quantity = toOptionalFiniteNumber(stock.quantity);
    const baseQuantity =
      toOptionalFiniteNumber(stock.baseQuantity) ?? toOptionalFiniteNumber(stock.quantity);

    if (productId && quantity !== null) {
      stockByProductId.set(productId, quantity);
    }

    if (stockProductId && baseQuantity !== null) {
      const current = baseStockByStockProductId.get(stockProductId);
      if (current === undefined) {
        baseStockByStockProductId.set(stockProductId, baseQuantity);
      } else {
        baseStockByStockProductId.set(stockProductId, Math.max(current, baseQuantity));
      }
    }
  });

  return {
    stockByProductId,
    baseStockByStockProductId,
  };
}

function extractProductStockQuantity(value: unknown) {
  const directStock = toOptionalFiniteNumber(value);
  if (directStock !== null) {
    return directStock;
  }

  const source = asRecord(value);
  return (
    toOptionalFiniteNumber(source.quantity) ??
    toOptionalFiniteNumber(source.availableQuantity) ??
    toOptionalFiniteNumber(source.baseQuantity)
  );
}

function readItemStock(item: ProductListItem) {
  return extractProductStockQuantity((item as Product).stock);
}

function resolveSharedRelativeStock(
  item: ProductListItem,
  stockContext?: StockResolverContext
) {
  if (!stockContext) return null;
  if (item.trackStock === false) return null;

  const productId = String(item.id ?? "").trim();
  const baseProductId = String(item.stockBaseProductId ?? "").trim();
  if (!productId || !baseProductId || productId === baseProductId) {
    return null;
  }

  const consumptionRaw = toOptionalFiniteNumber(item.stockConsumptionQuantity);
  const consumption =
    consumptionRaw !== null && consumptionRaw > 0 ? consumptionRaw : null;
  if (consumption === null) return null;

  const baseStock =
    stockContext.baseStockByStockProductId.get(baseProductId) ??
    stockContext.stockByProductId.get(baseProductId);
  if (!Number.isFinite(baseStock)) return null;

  const relative = Number(baseStock) / consumption;
  if (!Number.isFinite(relative)) return null;
  return Math.max(0, relative);
}

function applyStockToProduct(
  item: ProductListItem,
  stockContext?: StockResolverContext,
  branchId?: string | null
) {
  const directStock = stockContext?.stockByProductId.get(item.id);
  const sharedRelativeStock = resolveSharedRelativeStock(item, stockContext);
  const embeddedStock = readItemStock(item);

  const resolvedStock = Number.isFinite(directStock) && Number(directStock) > 0
    ? Number(directStock)
    : Number.isFinite(sharedRelativeStock)
    ? Number(sharedRelativeStock)
    : Number.isFinite(directStock)
    ? Number(directStock)
    : embeddedStock ?? 0;

  return {
    ...item,
    branchId: item.branchId ?? branchId ?? null,
    stock: resolvedStock,
  };
}

function invalidateStockCache(branchId?: string | null) {
  if (branchId) {
    stockCacheByBranch.delete(branchId);
    return;
  }
  stockCacheByBranch.clear();
}

function requireActiveBranchId() {
  const branchId = getApiSession().branchId;
  if (!branchId) {
    throw new Error("No hay sucursal activa en la sesion.");
  }
  return branchId;
}

function normalizeProductListItem(value: unknown): ProductListItem {
  const source = asRecord(value);
  const id = toOptionalText(source.id);
  if (!id) {
    throw new Error("Respuesta invalida: producto sin id.");
  }

  const measurementTypeRaw = toOptionalText(source.measurementType);
  const measurementType =
    measurementTypeRaw === "kg" ||
    measurementTypeRaw === "gram" ||
    measurementTypeRaw === "unit" ||
    measurementTypeRaw === "ml" ||
    measurementTypeRaw === "liter"
      ? measurementTypeRaw
      : "unit";

  return {
    id,
    sku: toOptionalText(source.sku) ?? id,
    barcode: toOptionalText(source.barcode),
    pluCode: toOptionalText(source.pluCode),
    isWeighable:
      typeof source.isWeighable === "boolean"
        ? source.isWeighable
        : measurementType === "kg" || measurementType === "gram",
    wholesaleMinQuantity: toOptionalFiniteNumber(source.wholesaleMinQuantity),
    name: toOptionalText(source.name) ?? "Producto",
    description: toOptionalText(source.description),
    costPrice: toFiniteNumber(source.costPrice, 0),
    wholesalePrice: toFiniteNumber(source.wholesalePrice, 0),
    retailPrice: toFiniteNumber(source.retailPrice, 0),
    marginPercent: toOptionalFiniteNumber(source.marginPercent),
    priceReviewPending:
      typeof source.priceReviewPending === "boolean"
        ? source.priceReviewPending
        : undefined,
    costReviewPending:
      typeof source.costReviewPending === "boolean"
        ? source.costReviewPending
        : undefined,
    isActive: typeof source.isActive === "boolean" ? source.isActive : undefined,
    categoryId: toOptionalText(source.categoryId),
    categoryName: toOptionalText(source.categoryName),
    branchId: toOptionalText(source.branchId),
    brand: toOptionalText(source.brand),
    trackStock:
      typeof source.trackStock === "boolean" ? source.trackStock : undefined,
    stockBaseProductId: toOptionalText(source.stockBaseProductId),
    stockConsumptionQuantity: toOptionalFiniteNumber(
      source.stockConsumptionQuantity
    ),
    stockBaseUnit: toOptionalText(source.stockBaseUnit) as
      | MeasurementType
      | null,
    allowNegativeStock:
      typeof source.allowNegativeStock === "boolean"
        ? source.allowNegativeStock
        : undefined,
    imageUrl: toOptionalText(source.imageUrl),
    measurementType,
    stock: extractProductStockQuantity(source.stock) ?? undefined,
    createdAt: toOptionalText(source.createdAt) ?? undefined,
    updatedAt: toOptionalText(source.updatedAt) ?? undefined,
  };
}

function normalizeProductListRows(payload: unknown): ProductListItem[] {
  const source = asRecord(payload);
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.results)
    ? source.results
    : [];

  return rawItems
    .map((item) => {
      try {
        return normalizeProductListItem(item);
      } catch {
        return null;
      }
    })
    .filter((item): item is ProductListItem => Boolean(item));
}

function normalizeBarcodePayload(
  payload: BarcodeLookupResponse
): ResolvedBarcodeProduct {
  const normalizeStock = (value: unknown) => {
    const source = asRecord(value);
    const branchId = toOptionalText(source.branchId);
    if (!branchId) return undefined;

    return {
      branchId,
      quantity: toFiniteNumber(source.quantity, 0),
      averageCost: toFiniteNumber(source.averageCost, 0),
      lastPurchaseCost: toFiniteNumber(source.lastPurchaseCost, 0),
      updatedAt: toOptionalText(source.updatedAt),
    };
  };

  const normalizePriceType = (value: unknown): PriceType | undefined => {
    if (value === "RETAIL" || value === "WHOLESALE") return value;
    return undefined;
  };

  const normalizePricingMode = (value: unknown): PricingMode | undefined => {
    if (value === "AUTO" || value === "MANUAL") return value;
    return undefined;
  };

  if (
    payload &&
    typeof payload === "object" &&
    "product" in payload &&
    payload.product
  ) {
    const barcodePayload = payload as {
      product: ProductListItem;
      quantity?: unknown;
      unitPrice?: unknown;
      subtotal?: unknown;
      barcodeType?: unknown;
      rawBarcode?: unknown;
      barcodeBase?: unknown;
      pluCode?: unknown;
      priceType?: unknown;
      pricingSource?: unknown;
      stock?: unknown;
    };
    const normalizedStock = normalizeStock(barcodePayload.stock);
    const normalizedProduct = normalizeProductListItem(barcodePayload.product);

    return {
      product: {
        ...normalizedProduct,
        branchId:
          normalizedProduct.branchId ?? normalizedStock?.branchId ?? null,
        stock:
          toOptionalFiniteNumber(normalizedProduct.stock) ??
          normalizedStock?.quantity ??
          undefined,
      },
      quantity: toFiniteNumber(barcodePayload.quantity, NaN),
      unitPrice: toFiniteNumber(barcodePayload.unitPrice, NaN),
      subtotal: toFiniteNumber(barcodePayload.subtotal, NaN),
      barcodeType:
        barcodePayload.barcodeType === "STANDARD" ||
        barcodePayload.barcodeType === "INTERNAL_EAN13"
          ? barcodePayload.barcodeType
          : undefined,
      rawBarcode: toOptionalText(barcodePayload.rawBarcode) ?? undefined,
      barcodeBase: toOptionalText(barcodePayload.barcodeBase) ?? undefined,
      pluCode: toOptionalText(barcodePayload.pluCode),
      priceType: normalizePriceType(barcodePayload.priceType),
      pricingSource: normalizePricingMode(barcodePayload.pricingSource),
      stock: normalizedStock,
    };
  }

  return {
    product: normalizeProductListItem(payload),
  };
}

function shouldHydrateScannedProduct(product: ProductListItem) {
  return ![product.retailPrice, product.wholesalePrice, product.costPrice].some(
    (value) => Number.isFinite(value) && value > 0
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTrimmedOrUndefined(value: unknown) {
  const normalized = toOptionalText(value);
  return normalized ?? undefined;
}

function toOptionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = toFiniteNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeReportingGlobalMetrics(
  payload: unknown
): ReportingGlobalMetricsResponse {
  const source = asRecord(payload);
  const rangeSource = asRecord(source.range);
  const salesSource = asRecord(source.sales);
  const byPaymentMethodSource = asRecord(salesSource.byPaymentMethod);

  return {
    range: {
      from: toOptionalText(rangeSource.from) ?? undefined,
      to: toOptionalText(rangeSource.to) ?? undefined,
    },
    sales: {
      byPaymentMethod: {
        cashTotal: toOptionalFiniteNumber(byPaymentMethodSource.cashTotal),
        transferTotal: toOptionalFiniteNumber(
          byPaymentMethodSource.transferTotal
        ),
        appliedTotal: toOptionalFiniteNumber(byPaymentMethodSource.appliedTotal),
        receivedCashTotal: toOptionalFiniteNumber(
          byPaymentMethodSource.receivedCashTotal
        ),
        receivedTransferTotal: toOptionalFiniteNumber(
          byPaymentMethodSource.receivedTransferTotal
        ),
        receivedTotal: toOptionalFiniteNumber(byPaymentMethodSource.receivedTotal),
      },
    },
  };
}

function extractDateKey(value: unknown): string | null {
  const text = toOptionalText(value);
  if (!text) return null;

  const exactDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactDate) {
    return `${exactDate[1]}-${exactDate[2]}-${exactDate[3]}`;
  }

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) {
    const leadingDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!leadingDate) return null;
    return `${leadingDate[1]}-${leadingDate[2]}-${leadingDate[3]}`;
  }

  const parts = reportingDateFormatter.formatToParts(parsedDate);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function shiftYmdDate(dateYmd: string, deltaDays: number): string | null {
  const match = dateYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const base = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(base.getTime())) return null;

  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

function normalizeCashBookEntry(row: unknown, index: number): CashBookEntry {
  const source = asRecord(row);
  const sourceTypeRaw =
    toOptionalText(source.sourceType) ??
    toOptionalText(source.entryType) ??
    toOptionalText(source.kind);
  const directionRaw = toOptionalText(source.direction);
  const legacyType = toOptionalText(source.type);

  const idCandidate = toOptionalText(source.id);
  const id = idCandidate ?? `cash-entry-${index}`;

  const sourceType = sourceTypeRaw ?? "UNKNOWN";
  const directionCandidate = directionRaw?.toUpperCase();
  let direction =
    directionCandidate === "IN" ||
    directionCandidate === "OUT" ||
    directionCandidate === "INFO"
      ? directionCandidate
      : "INFO";

  if (sourceType === "SALE_PAYMENT" && direction === "INFO") {
    direction = "IN";
  }

  const combinedType = [sourceTypeRaw, directionRaw]
    .filter((value): value is string => Boolean(value))
    .join(" / ");
  const typeLabel =
    legacyType ?? (combinedType.length > 0 ? combinedType : "MOVEMENT");

  const notes =
    toOptionalText(source.notes) ?? toOptionalText(source.description);
  const reference =
    toOptionalText(source.reference) ?? toOptionalText(source.saleId);
  const description =
    toOptionalText(source.description) ??
    toOptionalText(source.notes) ??
    toOptionalText(source.reference) ??
    directionRaw ??
    sourceTypeRaw ??
    null;
  const amount =
    toOptionalFiniteNumber(source.amount) ??
    toOptionalFiniteNumber(source.netAmount) ??
    toOptionalFiniteNumber(source.receivedAmount) ??
    0;

  return {
    id,
    sourceType,
    direction,
    type: typeLabel,
    amount,
    method: toOptionalText(source.method),
    receivedAmount: toOptionalFiniteNumber(source.receivedAmount),
    changeAmount: toOptionalFiniteNumber(source.changeAmount),
    netAmount: toOptionalFiniteNumber(source.netAmount),
    notes,
    reference,
    description,
    saleId: toOptionalText(source.saleId),
    sessionId: toOptionalText(source.sessionId),
    createdAt: toOptionalText(source.createdAt) ?? undefined,
  };
}

function normalizeStockSummary(payload: unknown): StockSummaryResponse {
  const source = asRecord(payload);
  const products = asRecord(source.products);
  const inventoryValue = asRecord(source.inventoryValue);
  const quantity = asRecord(source.quantity);

  return {
    products: {
      total: toFiniteNumber(products.total, 0),
      lowStock: toFiniteNumber(products.lowStock, 0),
    },
    inventoryValue: {
      cost: toFiniteNumber(inventoryValue.cost, 0),
      retail: toFiniteNumber(inventoryValue.retail, 0),
      wholesale: toFiniteNumber(inventoryValue.wholesale, 0),
    },
    quantity: {
      total: toFiniteNumber(quantity.total, 0),
    },
  };
}

function normalizeStockSummaryCategories(
  payload: unknown
): StockSummaryCategoriesResponse {
  const source = asRecord(payload);
  const rawItems = Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.byCategory)
    ? source.byCategory
    : Array.isArray(payload)
    ? payload
    : [];

  const items: StockSummaryCategoryItem[] = rawItems.map((row) => {
    const item = asRecord(row);
    return {
      categoryId: toOptionalText(item.categoryId ?? item.id),
      categoryName: toOptionalText(item.categoryName ?? item.name),
      productsTotal:
        toOptionalFiniteNumber(item.productsTotal ?? item.totalProducts) ??
        undefined,
      lowStockTotal:
        toOptionalFiniteNumber(item.lowStockTotal ?? item.lowStock) ??
        undefined,
      stockUnitsTotal:
        toOptionalFiniteNumber(item.stockUnitsTotal ?? item.quantityTotal) ??
        undefined,
      inventoryValueCost:
        toOptionalFiniteNumber(item.inventoryValueCost ?? item.totalCost) ??
        undefined,
      inventoryValueRetail:
        toOptionalFiniteNumber(item.inventoryValueRetail ?? item.totalRetail) ??
        undefined,
      inventoryValueWholesale:
        toOptionalFiniteNumber(
          item.inventoryValueWholesale ?? item.totalWholesale
        ) ?? undefined,
    };
  });

  return {
    items,
    total: toFiniteNumber(source.total, items.length),
  };
}

function normalizeMeasurementTypeValue(value: unknown): MeasurementType | null {
  const normalized = toOptionalText(value);
  if (
    normalized === "unit" ||
    normalized === "gram" ||
    normalized === "kg" ||
    normalized === "ml" ||
    normalized === "liter"
  ) {
    return normalized;
  }
  return null;
}

function normalizeStockSharedProduct(payload: unknown): StockSharedProduct | null {
  const source = asRecord(payload);
  const id = toOptionalText(source.id);
  const name = toOptionalText(source.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    sku: toOptionalText(source.sku),
    barcode: toOptionalText(source.barcode),
    pluCode: toOptionalText(source.pluCode),
    stockConsumptionQuantity: toOptionalFiniteNumber(
      source.stockConsumptionQuantity
    ),
    stockBaseUnit: normalizeMeasurementTypeValue(source.stockBaseUnit),
    isBase: typeof source.isBase === "boolean" ? source.isBase : undefined,
  };
}

function normalizeStockSharedRelation(
  payload: unknown,
  fallbackStockProductId?: string | null
): StockSharedRelation | null {
  const source = asRecord(payload);
  const linkedProductsRaw = Array.isArray(source.linkedProducts)
    ? source.linkedProducts
    : [];
  const linkedProducts = linkedProductsRaw
    .map((item) => normalizeStockSharedProduct(item))
    .filter((item): item is StockSharedProduct => Boolean(item));

  const linkedProductsCountRaw = toOptionalFiniteNumber(source.linkedProductsCount);
  const hasExplicitIsShared = typeof source.isShared === "boolean";
  const stockProductId =
    toOptionalText(source.stockProductId) ?? toOptionalText(fallbackStockProductId);

  if (
    !stockProductId &&
    !hasExplicitIsShared &&
    linkedProducts.length === 0 &&
    linkedProductsCountRaw === null
  ) {
    return null;
  }

  return {
    stockProductId,
    isShared: hasExplicitIsShared ? Boolean(source.isShared) : false,
    linkedProductsCount:
      linkedProductsCountRaw === null
        ? linkedProducts.length
        : Math.max(0, Math.trunc(linkedProductsCountRaw)),
    linkedProducts,
  };
}

function normalizeStockProductSnapshot(
  payload: unknown
): Partial<ProductListItem> & { minStock?: number; maxStock?: number } | null {
  const source = asRecord(payload);
  if (Object.keys(source).length === 0) return null;

  return {
    id: toOptionalText(source.id) ?? undefined,
    name: toOptionalText(source.name) ?? undefined,
    sku: toOptionalText(source.sku) ?? undefined,
    barcode: toOptionalText(source.barcode) ?? undefined,
    pluCode: toOptionalText(source.pluCode) ?? undefined,
    categoryId: toOptionalText(source.categoryId) ?? undefined,
    categoryName: toOptionalText(source.categoryName) ?? undefined,
    costPrice: toOptionalFiniteNumber(source.costPrice) ?? undefined,
    wholesalePrice: toOptionalFiniteNumber(source.wholesalePrice) ?? undefined,
    retailPrice: toOptionalFiniteNumber(source.retailPrice) ?? undefined,
    minStock: toOptionalFiniteNumber(source.minStock) ?? undefined,
    maxStock: toOptionalFiniteNumber(source.maxStock) ?? undefined,
    imageUrl: toOptionalText(source.imageUrl) ?? undefined,
    trackStock:
      typeof source.trackStock === "boolean" ? source.trackStock : undefined,
    measurementType:
      normalizeMeasurementTypeValue(source.measurementType) ?? undefined,
  };
}

function normalizeStockListItem(payload: unknown): StockListItem {
  const source = asRecord(payload);
  const productSnapshot = normalizeStockProductSnapshot(source.product);
  const productId =
    toOptionalText(source.productId) ?? toOptionalText(productSnapshot?.id) ?? "";
  const stockProductId =
    toOptionalText(source.stockProductId) ?? toOptionalText(productId);
  const rawQuantity = toOptionalFiniteNumber(source.quantity);
  const baseQuantity = toOptionalFiniteNumber(source.baseQuantity);
  const stockConsumptionQuantity = toOptionalFiniteNumber(
    source.stockConsumptionQuantity
  );
  const isLinkedStock = Boolean(
    productId && stockProductId && productId !== stockProductId
  );
  const canDeriveRelativeQuantity =
    isLinkedStock &&
    baseQuantity !== null &&
    stockConsumptionQuantity !== null &&
    stockConsumptionQuantity > 0;
  const derivedRelativeQuantity = canDeriveRelativeQuantity
    ? Math.max(0, baseQuantity / stockConsumptionQuantity)
    : null;
  const quantity =
    rawQuantity !== null && (rawQuantity > 0 || derivedRelativeQuantity === null)
      ? rawQuantity
      : derivedRelativeQuantity ?? toFiniteNumber(source.quantity, 0);
  const sharedStock = normalizeStockSharedRelation(
    source.sharedStock,
    stockProductId
  );
  const branchId = toOptionalText(source.branchId) ?? "";
  const rowId =
    toOptionalText(source.id) ??
    [branchId || "branch", productId || "product"].join(":");

  return {
    id: rowId,
    branchId,
    productId,
    stockProductId,
    quantity,
    baseQuantity,
    stockConsumptionQuantity,
    stockBaseUnit: normalizeMeasurementTypeValue(source.stockBaseUnit),
    sharedStock,
    averageCost: toFiniteNumber(source.averageCost, 0),
    createdAt: toOptionalText(source.createdAt) ?? undefined,
    updatedAt: toOptionalText(source.updatedAt) ?? undefined,
    name: toOptionalText(source.name ?? productSnapshot?.name),
    product: productSnapshot,
  };
}

function normalizeStockDetail(payload: unknown): StockDetail {
  const normalized = normalizeStockListItem(payload);
  return {
    ...normalized,
    stockProductId:
      normalized.stockProductId ?? toOptionalText(normalized.productId) ?? null,
    baseQuantity:
      normalized.baseQuantity ?? toOptionalFiniteNumber(normalized.quantity),
  };
}

function resolveStockRowConsumptionQuantity(row: StockListItem) {
  const direct = toOptionalFiniteNumber(row.stockConsumptionQuantity);
  if (direct !== null && direct > 0) return direct;

  const linkedProducts = Array.isArray(row.sharedStock?.linkedProducts)
    ? row.sharedStock?.linkedProducts ?? []
    : [];
  const linkedCurrent = linkedProducts.find(
    (linked) => String(linked.id ?? "").trim() === String(row.productId ?? "").trim()
  );
  const linkedConsumption = toOptionalFiniteNumber(
    linkedCurrent?.stockConsumptionQuantity
  );
  if (linkedConsumption !== null && linkedConsumption > 0) {
    return linkedConsumption;
  }

  return null;
}

function applyRelativeStockToStockRows(rows: StockListItem[]): StockListItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const baseQuantityByStockProductId = new Map<string, number>();

  rows.forEach((row) => {
    const stockProductId = String(row.stockProductId ?? row.productId ?? "").trim();
    if (!stockProductId) return;

    const directBase = toOptionalFiniteNumber(row.baseQuantity);
    const inferredBase =
      directBase !== null
        ? directBase
        : String(row.productId ?? "").trim() === stockProductId
        ? toOptionalFiniteNumber(row.quantity)
        : null;
    if (inferredBase === null) return;

    const current = baseQuantityByStockProductId.get(stockProductId);
    if (current === undefined) {
      baseQuantityByStockProductId.set(stockProductId, inferredBase);
      return;
    }
    baseQuantityByStockProductId.set(stockProductId, Math.max(current, inferredBase));
  });

  return rows.map((row) => {
    const stockProductId = String(row.stockProductId ?? row.productId ?? "").trim();
    const productId = String(row.productId ?? "").trim();
    if (!stockProductId || !productId || stockProductId === productId) {
      const baseQuantity = toOptionalFiniteNumber(row.baseQuantity);
      if (baseQuantity === null) return row;
      return {
        ...row,
        baseQuantity,
      };
    }

    const baseQuantity = baseQuantityByStockProductId.get(stockProductId);
    const consumption = resolveStockRowConsumptionQuantity(row);
    if (
      !Number.isFinite(baseQuantity) ||
      consumption === null ||
      !Number.isFinite(consumption) ||
      consumption <= 0
    ) {
      return row;
    }

    const derivedQuantity = Math.max(0, Number(baseQuantity) / consumption);
    const currentQuantity = toOptionalFiniteNumber(row.quantity);
    const shouldOverrideQuantity =
      currentQuantity === null || !Number.isFinite(currentQuantity) || currentQuantity <= 0;

    return {
      ...row,
      quantity: shouldOverrideQuantity ? derivedQuantity : currentQuantity,
      baseQuantity: row.baseQuantity ?? Number(baseQuantity),
    };
  });
}

function normalizeStockLot(payload: unknown): StockLot {
  const source = asRecord(payload);
  const productSource = asRecord(source.product);

  return {
    id: toOptionalText(source.id) ?? "",
    branchId: toOptionalText(source.branchId) ?? "",
    productId:
      toOptionalText(source.productId) ??
      toOptionalText(productSource.id) ??
      "",
    lotCode: toOptionalText(source.lotCode) ?? "",
    expiresAt: toOptionalText(source.expiresAt) ?? "",
    quantity: toFiniteNumber(source.quantity, 0),
    notes: toOptionalText(source.notes),
    createdAt: toOptionalText(source.createdAt) ?? undefined,
    updatedAt: toOptionalText(source.updatedAt) ?? undefined,
    daysUntilExpiry: toOptionalFiniteNumber(source.daysUntilExpiry),
    status: toOptionalText(source.status) ?? null,
    product:
      Object.keys(productSource).length > 0
        ? {
            id: toOptionalText(productSource.id) ?? "",
            name: toOptionalText(productSource.name) ?? "Producto",
            sku: toOptionalText(productSource.sku),
            barcode: toOptionalText(productSource.barcode),
            pluCode: toOptionalText(productSource.pluCode),
            categoryId: toOptionalText(productSource.categoryId),
            categoryName: toOptionalText(productSource.categoryName),
          }
        : null,
  };
}

function normalizeStockLotsListResponse(
  payload: unknown,
  fallbackPage: number,
  fallbackLimit: number
): StockLotsListResponse {
  const source = asRecord(payload);
  const rawItems = Array.isArray(source.items)
    ? source.items
    : Array.isArray(payload)
    ? payload
    : [];
  const items = rawItems.map((item) => normalizeStockLot(item));
  const offset = Math.max(0, (fallbackPage - 1) * Math.max(1, fallbackLimit));
  const meta = normalizeOffsetMeta(
    source.meta,
    offset,
    Math.max(1, fallbackLimit),
    items.length
  );
  const filtersSource = asRecord(source.filters);

  return {
    items,
    filters: {
      search: toOptionalText(filtersSource.search) ?? undefined,
      productId: toOptionalText(filtersSource.productId) ?? undefined,
      categoryId: toOptionalText(filtersSource.categoryId) ?? undefined,
      days: toOptionalFiniteNumber(filtersSource.days) ?? undefined,
      includeExpired:
        typeof filtersSource.includeExpired === "boolean"
          ? filtersSource.includeExpired
          : undefined,
      onlyPositive:
        typeof filtersSource.onlyPositive === "boolean"
          ? filtersSource.onlyPositive
          : undefined,
      page: toOptionalFiniteNumber(filtersSource.page) ?? undefined,
      limit: toOptionalFiniteNumber(filtersSource.limit) ?? undefined,
    },
    meta,
  };
}

function normalizeSalesSummaryItems(
  payload: unknown,
  keyCandidates: string[]
): Array<{
  key: string;
  label?: string | null;
  unitsTotal: number;
  revenueTotal: number;
  costTotal?: number;
  profitTotal?: number;
  marginPercent?: number;
  itemCount?: number;
  saleCount?: number;
  salesCount?: number;
}> {
  const source = asRecord(payload);
  const parseRow = (row: unknown, fallbackKey?: string) => {
    const item = asRecord(row);

    const key =
      keyCandidates
        .map((candidate) => toOptionalText(item[candidate]))
        .find((value): value is string => Boolean(value)) ??
      toOptionalText(item.key) ??
      toOptionalText(item.type) ??
      toOptionalText(item.bucket) ??
      toOptionalText(item.name) ??
      toOptionalText(item.label) ??
      fallbackKey ??
      null;

    if (!key) return null;

    const unitsTotal = toFiniteNumber(
      item.unitsTotal ??
        item.units ??
        item.totalUnits ??
        item.quantity ??
        item.qty,
      0
    );
    const revenueTotal = toFiniteNumber(
      item.revenueTotal ??
        item.revenue ??
        item.totalRevenue ??
        item.amount ??
        item.totalAmount,
      0
    );
    const salesCount = toOptionalFiniteNumber(
      item.salesCount ??
        item.saleCount ??
        item.ordersTotal ??
        item.orders ??
        item.tickets ??
        item.transactions
    );
    const costTotal = toOptionalFiniteNumber(
      item.costTotal ?? item.cost ?? item.totalCost
    );
    const profitTotal = toOptionalFiniteNumber(
      item.profitTotal ??
        item.profit ??
        item.marginTotal ??
        item.margin ??
        item.gain
    );
    const marginPercent = toOptionalFiniteNumber(
      item.marginPercent ??
        item.marginPct ??
        item.profitPercent ??
        item.profitPct
    );
    const itemCount = toOptionalFiniteNumber(
      item.itemCount ?? item.itemsCount ?? item.lines ?? item.lineItems
    );
    const saleCount = toOptionalFiniteNumber(
      item.saleCount ?? item.salesCount ?? item.transactions
    );

    return {
      key,
      label: toOptionalText(item.label ?? item.name),
      unitsTotal,
      revenueTotal,
      costTotal: costTotal ?? undefined,
      profitTotal: profitTotal ?? undefined,
      marginPercent: marginPercent ?? undefined,
      itemCount: itemCount ?? undefined,
      saleCount: saleCount ?? undefined,
      salesCount: salesCount ?? undefined,
    };
  };

  const itemsSource =
    source.items ??
    source.rows ??
    source.data ??
    source.byType ??
    source.bySource;
  const parsed: Array<{
    key: string;
    label?: string | null;
    unitsTotal: number;
    revenueTotal: number;
    costTotal?: number;
    profitTotal?: number;
    marginPercent?: number;
    itemCount?: number;
    saleCount?: number;
    salesCount?: number;
  }> = [];

  if (Array.isArray(itemsSource)) {
    itemsSource.forEach((row) => {
      const normalized = parseRow(row);
      if (normalized) parsed.push(normalized);
    });
  } else if (Array.isArray(payload)) {
    payload.forEach((row) => {
      const normalized = parseRow(row);
      if (normalized) parsed.push(normalized);
    });
  } else if (itemsSource && typeof itemsSource === "object") {
    Object.entries(asRecord(itemsSource)).forEach(([bucketKey, value]) => {
      const normalized = parseRow(value, bucketKey);
      if (normalized) parsed.push(normalized);
    });
  } else {
    Object.entries(source).forEach(([bucketKey, value]) => {
      if (
        bucketKey === "range" ||
        bucketKey === "filters" ||
        bucketKey === "meta" ||
        bucketKey === "totals" ||
        bucketKey === "summary"
      ) {
        return;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      const normalized = parseRow(value, bucketKey);
      if (normalized) parsed.push(normalized);
    });
  }

  const dedupedByKey = new Map<string, (typeof parsed)[number]>();
  parsed.forEach((item) => {
    dedupedByKey.set(item.key.toUpperCase(), {
      ...item,
      key: item.key.toUpperCase(),
    });
  });

  return [...dedupedByKey.values()];
}

function normalizeSalesSummaryTotals(payload: unknown) {
  const source = asRecord(payload);
  const totals = asRecord(source.totals);
  const summary = asRecord(source.summary);
  const totalsSource =
    Object.keys(totals).length > 0
      ? totals
      : Object.keys(summary).length > 0
      ? summary
      : source;

  const unitsTotal = toOptionalFiniteNumber(
    totalsSource.unitsTotal ??
      totalsSource.units ??
      totalsSource.totalUnits ??
      totalsSource.quantity ??
      totalsSource.qty
  );
  const revenueTotal = toOptionalFiniteNumber(
    totalsSource.revenueTotal ??
      totalsSource.revenue ??
      totalsSource.totalRevenue ??
      totalsSource.amount ??
      totalsSource.totalAmount
  );
  const costTotal = toOptionalFiniteNumber(
    totalsSource.costTotal ?? totalsSource.cost ?? totalsSource.totalCost
  );
  const profitTotal = toOptionalFiniteNumber(
    totalsSource.profitTotal ??
      totalsSource.profit ??
      totalsSource.marginTotal ??
      totalsSource.margin ??
      totalsSource.gain
  );
  const marginPercent = toOptionalFiniteNumber(
    totalsSource.marginPercent ??
      totalsSource.marginPct ??
      totalsSource.profitPercent ??
      totalsSource.profitPct
  );
  const itemCount = toOptionalFiniteNumber(
    totalsSource.itemCount ??
      totalsSource.itemsCount ??
      totalsSource.lines ??
      totalsSource.lineItems
  );
  const saleCount = toOptionalFiniteNumber(
    totalsSource.saleCount ??
      totalsSource.salesCount ??
      totalsSource.transactions
  );

  if (
    unitsTotal === null &&
    revenueTotal === null &&
    costTotal === null &&
    profitTotal === null &&
    marginPercent === null &&
    itemCount === null &&
    saleCount === null
  ) {
    return undefined;
  }

  return {
    unitsTotal: unitsTotal ?? 0,
    revenueTotal: revenueTotal ?? 0,
    costTotal: costTotal ?? 0,
    profitTotal: profitTotal ?? 0,
    marginPercent: marginPercent ?? 0,
    itemCount: itemCount ?? 0,
    saleCount: saleCount ?? 0,
  };
}

function normalizeSalesPriceTypesSummary(
  payload: unknown
): ReportsSalesPriceTypesSummaryResponse {
  const source = asRecord(payload);
  const range = asRecord(source.range);
  const filters = asRecord(source.filters);

  return {
    range: {
      from: toOptionalText(range.from) ?? toOptionalText(source.from) ?? "",
      to: toOptionalText(range.to) ?? toOptionalText(source.to) ?? "",
    },
    filters: {
      branchId:
        toOptionalText(filters.branchId) ?? toOptionalText(source.branchId),
      categoryId:
        toOptionalText(filters.categoryId) ?? toOptionalText(source.categoryId),
    },
    items: normalizeSalesSummaryItems(payload, ["priceType", "type"]),
    totals: normalizeSalesSummaryTotals(payload),
  };
}

function normalizeSalesPricingSourcesSummary(
  payload: unknown
): ReportsSalesPricingSourcesSummaryResponse {
  const source = asRecord(payload);
  const range = asRecord(source.range);
  const filters = asRecord(source.filters);

  return {
    range: {
      from: toOptionalText(range.from) ?? toOptionalText(source.from) ?? "",
      to: toOptionalText(range.to) ?? toOptionalText(source.to) ?? "",
    },
    filters: {
      branchId:
        toOptionalText(filters.branchId) ?? toOptionalText(source.branchId),
      categoryId:
        toOptionalText(filters.categoryId) ?? toOptionalText(source.categoryId),
    },
    items: normalizeSalesSummaryItems(payload, [
      "pricingSource",
      "source",
      "mode",
    ]),
  };
}

function normalizeCashSessionFromUnknown(value: unknown): CashSession | null {
  const source = asRecord(value);
  const id = toOptionalText(source.id);
  if (!id) return null;

  const statusRaw = toOptionalText(source.status)?.toUpperCase();
  const status = statusRaw === "CLOSED" ? "CLOSED" : "OPEN";

  const totalsSource = asRecord(source.totals);
  const totals =
    Object.keys(totalsSource).length > 0
      ? {
          cashPayments: toOptionalFiniteNumber(totalsSource.cashPayments) ?? 0,
          transferPayments:
            toOptionalFiniteNumber(totalsSource.transferPayments) ?? 0,
          movementIn: toOptionalFiniteNumber(totalsSource.movementIn) ?? 0,
          movementOut: toOptionalFiniteNumber(totalsSource.movementOut) ?? 0,
        }
      : undefined;

  return {
    id,
    branchId: toOptionalText(source.branchId) ?? "",
    status,
    openingFloat: toFiniteNumber(source.openingFloat, 0),
    openedByUserId: toTrimmedOrUndefined(source.openedByUserId),
    closedByUserId: toTrimmedOrUndefined(source.closedByUserId),
    openedAt: toOptionalText(source.openedAt) ?? undefined,
    closedAt: toOptionalText(source.closedAt),
    expectedCash: toOptionalFiniteNumber(source.expectedCash) ?? undefined,
    countedCash: toOptionalFiniteNumber(source.countedCash) ?? undefined,
    difference: toOptionalFiniteNumber(source.difference) ?? undefined,
    notes: toOptionalText(source.notes) ?? undefined,
    salesCount: toOptionalFiniteNumber(source.salesCount) ?? undefined,
    paymentsCount: toOptionalFiniteNumber(source.paymentsCount) ?? undefined,
    lastActivityAt: toOptionalText(source.lastActivityAt),
    totals,
  };
}

function normalizeCashCurrentSummary(
  payload: unknown
): CashCurrentSummaryResponse {
  const source = asRecord(payload);
  const sessionCandidate =
    source.session ??
    source.currentSession ??
    source.cashSession ??
    source.openSession ??
    payload;
  const session = normalizeCashSessionFromUnknown(sessionCandidate);
  const explicitOpen = source.hasOpenSession ?? source.hasOpen ?? source.open;
  const hasOpenSession =
    typeof explicitOpen === "boolean"
      ? explicitOpen
      : Boolean(session && session.status === "OPEN");

  return {
    hasOpenSession,
    session: hasOpenSession ? session : null,
    branchId: toOptionalText(source.branchId) ?? session?.branchId ?? null,
    updatedAt:
      toOptionalText(source.updatedAt) ??
      toOptionalText(source.lastModified) ??
      toOptionalText(source.at),
  };
}

async function getCachedStocksForBranch(branchId: string) {
  const cached = stockCacheByBranch.get(branchId);
  const now = Date.now();
  if (cached && now - cached.cachedAt < STOCK_CACHE_TTL_MS) {
    return cached.rows;
  }

  const rows = await backendApi.stocks.listByBranch(branchId);
  stockCacheByBranch.set(branchId, { cachedAt: now, rows });
  return rows;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function waitMs(ms: number, signal?: AbortSignal) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort);
  });
}

async function withRateLimitRetry<T>(
  execute: () => Promise<T>,
  signal?: AbortSignal,
  maxRetries = 2
) {
  let retries = 0;

  while (true) {
    try {
      return await execute();
    } catch (error) {
      if (isAbortError(error)) throw error;

      if (!(error instanceof ApiError) || error.status !== 429) {
        throw error;
      }

      if (retries >= maxRetries) {
        throw error;
      }

      const retrySeconds = error.retryAfterSeconds ?? 1 + retries;
      const backoffSeconds = Math.max(1, Math.ceil(retrySeconds));
      await waitMs(backoffSeconds * 1000, signal);
      retries += 1;
    }
  }
}

export const backendApi = {
  auth: {
    login: (body: LoginRequest) =>
      apiClientFetch.post<AuthResponse>("/auth/login", body, {
        branchScoped: false,
      }),
    switchBranch: (body: SwitchBranchRequest) =>
      apiClientFetch.post<SessionResponse>("/auth/switch-branch", body, {
        branchScoped: false,
      }),
    refresh: (body?: RefreshRequest) =>
      apiClientFetch.post<AuthResponse>("/auth/refresh", body ?? {}, {
        branchScoped: false,
      }),
    logout: (body?: LogoutRequest) =>
      apiClientFetch.post<LogoutResponse>("/auth/logout", body ?? {}, {
        branchScoped: false,
      }),
  },
  pos: {
    search: async (
      query: { q: string; limit?: number },
      branchIdOverride?: string | null,
      options?: { signal?: AbortSignal }
    ) => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }

      const normalizedQuery = toTrimmedOrUndefined(query.q);
      const safeLimit = Math.max(
        1,
        Math.min(20, Math.trunc(Number(query.limit ?? 8)) || 8)
      );

      if (!normalizedQuery) {
        return [] as ProductListItem[];
      }

      const payload = await apiClientFetch.get<unknown>(
        `/pos/search${buildQuery(
          {
            q: normalizedQuery,
            limit: safeLimit,
          },
          {
            preserveLimitAndOffset: true,
          }
        )}`,
        {
          headers: {
            "x-branch-id": effectiveBranchId,
          },
          signal: options?.signal,
        }
      );

      return normalizeProductListRows(payload);
    },
  },
  users: {
    list: () => apiClientFetch.get<User[]>("/users", { branchScoped: false }),
    getById: (id: string) =>
      apiClientFetch.get<User>(`/users/${id}`, { branchScoped: false }),
    create: (body: CreateUserRequest) =>
      apiClientFetch.post<User>("/users", body, { branchScoped: false }),
    update: (id: string, body: UpdateUserRequest) =>
      apiClientFetch.patch<User>(`/users/${id}`, body, { branchScoped: false }),
    updateBranches: (id: string, body: UpdateUserBranchesRequest) =>
      apiClientFetch.patch<User>(`/users/${id}/branches`, body, {
        branchScoped: false,
      }),
    remove: (id: string) =>
      apiClientFetch.delete<boolean>(`/users/${id}`, { branchScoped: false }),
  },
  userBranches: {
    updateBranches: (id: string, body: UpdateUserBranchesRequest) =>
      apiClientFetch.patch<User>(`/user-branches/${id}/branches`, body, {
        branchScoped: false,
      }),
  },
  branches: {
    list: () =>
      apiClientFetch.get<Branch[]>("/branches", { branchScoped: false }),
    getById: (id: string) =>
      apiClientFetch.get<Branch>(`/branches/${id}`, { branchScoped: false }),
    create: (body: CreateBranchRequest) =>
      apiClientFetch.post<Branch>("/branches", body, { branchScoped: false }),
    update: (id: string, body: UpdateBranchRequest) =>
      apiClientFetch.patch<Branch>(`/branches/${id}`, body, {
        branchScoped: false,
      }),
    remove: (id: string) =>
      apiClientFetch.delete<boolean>(`/branches/${id}`, {
        branchScoped: false,
      }),
    bootstrap: (body: CreateBranchRequest) =>
      apiClientFetch.post<BootstrapBranchResponse>(
        "/branches/bootstrap",
        body,
        {
          branchScoped: false,
        }
      ),
  },
  categories: {
    list: () =>
      apiClientFetch.get<Category[]>("/categories", { branchScoped: false }),
    create: (body: CreateCategoryRequest) =>
      apiClientFetch.post<Category>("/categories", body, {
        branchScoped: false,
      }),
    update: (id: string, body: UpdateCategoryRequest) =>
      apiClientFetch.patch<UpdateResult>(`/categories/${id}`, body, {
        branchScoped: false,
      }),
    remove: (id: string) =>
      apiClientFetch.delete<DeleteResult>(`/categories/${id}`, {
        branchScoped: false,
      }),
  },
  products: {
    create: async (body: CreateProductRequest) => {
      const created = await apiClientFetch.post<Product>("/products", body);
      emitProductsSync(
        created.branchId ?? body.branchId ?? getApiSession().branchId
      );
      return created;
    },
    resolveBarcode: async (
      code: string,
      options?: {
        pricingMode?: PricingMode;
        requestedPriceType?: PriceType;
        manualOverrideReason?: string;
        hydrateProductDetails?: boolean;
        hydrateStock?: boolean;
        branchId?: string | null;
      }
    ) => {
      const normalizedCode = code.trim();
      const {
        hydrateProductDetails = false,
        hydrateStock = false,
        branchId: branchIdOverride,
        ...requestOptions
      } = options ?? {};
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const query = Object.keys(requestOptions).length
        ? buildQuery(requestOptions, { preserveLimitAndOffset: true })
        : "";
      const payload = await apiClientFetch.get<BarcodeLookupResponse>(
        `/pos/scan/${encodeURIComponent(normalizedCode)}${query}`,
        {
          branchScoped: true,
          headers: {
            "x-branch-id": effectiveBranchId,
          },
        }
      );
      let normalized = normalizeBarcodePayload(payload);

      if (
        hydrateProductDetails &&
        shouldHydrateScannedProduct(normalized.product)
      ) {
        try {
          const fullProduct = await apiClientFetch.get<ProductListItem>(
            `/products/${normalized.product.id}`
          );
          normalized = {
            ...normalized,
            product: {
              ...normalized.product,
              ...fullProduct,
              stock: normalized.product.stock ?? fullProduct.stock,
            },
          };
        } catch {
          // Keep the scan payload product if enrichment fails.
        }
      }

      const branchId = effectiveBranchId;
      const hasKnownStock = Number.isFinite(
        toOptionalFiniteNumber(normalized.product.stock)
      );
      if (
        !hydrateStock ||
        !branchId ||
        hasKnownStock ||
        normalized.product.trackStock === false
      ) {
        return normalized;
      }

      try {
        const stock = await apiClientFetch.get<Stock>(
          `/stocks/branch/${branchId}/product/${normalized.product.id}`
        );
        return {
          ...normalized,
          product: {
            ...normalized.product,
            stock: Number(stock.quantity ?? 0),
          },
        } satisfies ResolvedBarcodeProduct;
      } catch {
        return normalized;
      }
    },
    getByBarcode: async (code: string) => {
      const resolved = await backendApi.products.resolveBarcode(code);
      return resolved.product;
    },
    list: async (
      query: ProductsQuery = {},
      branchIdOverride?: string | null,
      options?: { signal?: AbortSignal }
    ) => {
      const normalizedTextSearch = toTrimmedOrUndefined(
        query.search ?? query.q ?? query.name
      );
      const normalizedQuery: ProductsQuery = {
        ...query,
        search: normalizedTextSearch,
        q: normalizedTextSearch,
        name: normalizedTextSearch,
      };
      const fallbackOffset = Number(query.offset ?? query.skip ?? 0);
      const fallbackLimit = Number(query.limit ?? query.take ?? 20);
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const payload = await apiClientFetch.get<ProductsListResponse>(
        `/products${buildQuery(normalizedQuery)}`,
        effectiveBranchId
          ? {
              headers: {
                "x-branch-id": effectiveBranchId,
              },
              signal: options?.signal,
            }
          : undefined
      );

      if ("meta" in payload) {
        return toPaginatedResponse<ProductListItem>(
          payload as PaginatedResponse<ProductListItem>,
          fallbackOffset,
          fallbackLimit
        );
      }

      const page = normalizeProductsPage(payload, normalizedQuery);
      return {
        items: page.items,
        meta: normalizeOffsetMeta(
          {
            total: page.total,
            offset: page.skip,
            limit: page.take,
            hasMore: page.hasMore,
          },
          page.skip,
          page.take,
          page.total
        ),
      } satisfies PaginatedResponse<ProductListItem>;
    },
    getById: (id: string) =>
      apiClientFetch.get<ProductListItem>(`/products/${id}`),
    update: async (id: string, body: UpdateProductRequest) => {
      const updated = await apiClientFetch.patch<Product | null>(
        `/products/${id}`,
        body
      );
      emitProductsSync(
        updated?.branchId ?? body.branchId ?? getApiSession().branchId
      );
      return updated;
    },
    updateReviewFlags: async (
      id: string,
      body: UpdateProductReviewFlagsRequest
    ) => {
      const updated = await apiClientFetch.patch<Product>(
        `/products/${id}/review-flags`,
        body
      );
      emitProductsSync(updated.branchId ?? getApiSession().branchId);
      return updated;
    },
    reviewPending: async (
      query: ProductReviewPendingQuery = {},
      branchIdOverride?: string | null
    ) => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const payload = await apiClientFetch.get<
        PaginatedResponse<ProductListItem> | ProductListItem[]
      >(
        `/products/review-pending${buildQuery(query)}`,
        effectiveBranchId
          ? {
              headers: {
                "x-branch-id": effectiveBranchId,
              },
            }
          : undefined
      );
      return toPaginatedResponse(
        payload,
        Number(query.skip ?? query.offset ?? 0),
        Number(query.take ?? query.limit ?? 20)
      );
    },
    priceHistory: async (
      query: ProductPriceCostHistoryQuery = {},
      branchIdOverride?: string | null
    ) => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const payload = await apiClientFetch.get<
        | PaginatedResponse<ProductPriceCostHistoryRow>
        | ProductPriceCostHistoryRow[]
      >(
        `/products/history/prices${buildQuery(query)}`,
        effectiveBranchId
          ? {
              headers: {
                "x-branch-id": effectiveBranchId,
              },
            }
          : undefined
      );
      return toPaginatedResponse(
        payload
        // Number(query.skip ?? query.offset ?? 0),
        // Number(query.take ?? query.limit ?? 20)
      );
    },
    remove: async (id: string) => {
      const deleted = await apiClientFetch.delete<boolean>(`/products/${id}`);
      emitProductsSync(getApiSession().branchId);
      return deleted;
    },
    uploadImageByProductId: async (id: string, formData: FormData) => {
      const uploaded = await apiClientFetch.post<UploadImageResponse>(
        `/products/${id}/image`,
        formData
      );
      emitProductsSync(uploaded.product?.branchId ?? getApiSession().branchId);
      return uploaded;
    },
  },
  files: {
    uploadProductImage: (formData: FormData) =>
      apiClientFetch.post<UploadImageResponse>("/files/upload", formData),
  },
  stocks: {
    create: async (body: CreateStockRequest) => {
      const { branchId: _branchId, ...payload } = body;
      const created = await apiClientFetch.post<unknown>("/stocks", payload);
      invalidateStockCache(getApiSession().branchId);
      return normalizeStockListItem(created);
    },
    list: async (
      query: StockQuery = {},
      branchIdOverride?: string | null,
      options?: { signal?: AbortSignal }
    ) => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const safeLimit = Math.max(
        1,
        Math.min(100, Math.trunc(Number(query.limit ?? query.take ?? 100)) || 100)
      );
      const offsetCandidate = Number(query.offset ?? query.skip ?? Number.NaN);
      const pageFromOffset = Number.isFinite(offsetCandidate)
        ? Math.floor(Math.max(0, offsetCandidate) / safeLimit) + 1
        : 1;
      const safePage = Math.max(
        1,
        Math.trunc(Number(query.page ?? pageFromOffset)) || 1
      );
      const normalizedSearch =
        toTrimmedOrUndefined(query.search) ??
        toTrimmedOrUndefined(query.q) ??
        toTrimmedOrUndefined(query.name);
      const safeQuery = {
        search: normalizedSearch,
        productId: toTrimmedOrUndefined(query.productId),
        categoryId: toTrimmedOrUndefined(query.categoryId),
        stockStatus: toTrimmedOrUndefined(query.stockStatus),
        lowStockThreshold:
          query.lowStockThreshold === undefined || query.lowStockThreshold === null
            ? undefined
            : Number(query.lowStockThreshold),
        page: safePage,
        limit: safeLimit,
      };
      const payload = await apiClientFetch.get<
        PaginatedResponse<unknown> | unknown[]
      >(
        `/stocks${buildQuery(safeQuery, {
          preserveLimitAndOffset: true,
        })}`,
        {
          headers: {
            "x-branch-id": effectiveBranchId,
          },
          signal: options?.signal,
        },
      );
      const fallbackOffset = Math.max(0, (safePage - 1) * safeLimit);
      const normalizedPayload =
        Array.isArray(payload) && payload.length > safeLimit
          ? {
              items: payload.slice(fallbackOffset, fallbackOffset + safeLimit),
              meta: {
                total: payload.length,
                offset: fallbackOffset,
                limit: safeLimit,
                page: safePage,
                hasMore: fallbackOffset + safeLimit < payload.length,
              },
            }
          : payload;
      const page = toPaginatedResponse(
        normalizedPayload,
        fallbackOffset,
        safeLimit
      );
      const normalizedItems = applyRelativeStockToStockRows(
        page.items.map((item) => normalizeStockListItem(item))
      );
      return {
        ...page,
        items: normalizedItems,
      };
    },
    listByBranch: async (branchId: string) => {
      const payload = await apiClientFetch.get<
        PaginatedResponse<unknown> | unknown[] | { items?: unknown[] | null }
      >(`/stocks/branch/${branchId}`);

      if (Array.isArray(payload)) {
        return applyRelativeStockToStockRows(
          payload.map((row) => normalizeStockListItem(row))
        );
      }

      if (
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { items?: unknown }).items)
      ) {
        return applyRelativeStockToStockRows(
          (payload as { items: unknown[] }).items.map((row) =>
            normalizeStockListItem(row)
          )
        );
      }

      return [];
    },
    getByBranchAndProduct: async (branchId: string, productId: string) => {
      const payload = await apiClientFetch.get<unknown>(
        `/stocks/branch/${branchId}/product/${productId}`
      );
      return normalizeStockDetail(payload);
    },
    summary: async (
      query: { lowStockThreshold?: number } = {},
      branchIdOverride?: string | null
    ): Promise<StockSummaryResponse> => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const payload = await apiClientFetch.get<unknown>(
        `/stocks/summary${buildQuery({
          lowStockThreshold: query.lowStockThreshold ?? 5,
        })}`,
        {
          headers: {
            "x-branch-id": effectiveBranchId,
          },
        }
      );
      return normalizeStockSummary(payload);
    },
    summaryCategories: async (
      query: { lowStockThreshold?: number } = {},
      branchIdOverride?: string | null
    ): Promise<StockSummaryCategoriesResponse> => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const payload = await apiClientFetch.get<unknown>(
        `/stocks/summary/categories${buildQuery({
          lowStockThreshold: query.lowStockThreshold ?? 5,
        })}`,
        {
          headers: {
            "x-branch-id": effectiveBranchId,
          },
        }
      );
      return normalizeStockSummaryCategories(payload);
    },
    lots: {
      list: async (
        query: StockLotsListQuery = {},
        branchIdOverride?: string | null
      ): Promise<StockLotsListResponse> => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        const safeLimit = Math.max(
          1,
          Math.min(100, Math.trunc(Number(query.limit ?? 20)) || 20)
        );
        const safePage = Math.max(1, Math.trunc(Number(query.page ?? 1)) || 1);
        const safeQuery = {
          search: toTrimmedOrUndefined(query.search),
          productId: toTrimmedOrUndefined(query.productId),
          categoryId: toTrimmedOrUndefined(query.categoryId),
          days:
            query.days === undefined || query.days === null
              ? undefined
              : Math.max(0, Math.trunc(Number(query.days)) || 0),
          includeExpired:
            typeof query.includeExpired === "boolean"
              ? query.includeExpired
              : undefined,
          onlyPositive:
            typeof query.onlyPositive === "boolean"
              ? query.onlyPositive
              : undefined,
          page: safePage,
          limit: safeLimit,
        };

        const payload = await apiClientFetch.get<unknown>(
          `/stocks/lots${buildQuery(safeQuery, {
            preserveLimitAndOffset: true,
          })}`,
          {
            headers: {
              "x-branch-id": effectiveBranchId,
            },
          }
        );

        return normalizeStockLotsListResponse(payload, safePage, safeLimit);
      },
      create: async (
        body: UpsertStockLotRequest,
        branchIdOverride?: string | null
      ): Promise<StockLot> => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        const payload: UpsertStockLotRequest = {
          productId: toTrimmedOrUndefined(body.productId) ?? "",
          lotCode: toTrimmedOrUndefined(body.lotCode) ?? "",
          expiresAt: toTrimmedOrUndefined(body.expiresAt) ?? "",
          quantity: toFiniteNumber(body.quantity, 0),
          notes: toTrimmedOrUndefined(body.notes),
        };

        const created = await apiClientFetch.post<unknown>(
          "/stocks/lots",
          payload,
          {
            headers: {
              "x-branch-id": effectiveBranchId,
            },
          }
        );

        invalidateStockCache(effectiveBranchId);
        return normalizeStockLot(created);
      },
    },
  },
  stockMovements: {
    list: async (query: MovementQuery = {}, branchIdOverride?: string | null) => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const payload = await apiClientFetch.get<
        PaginatedResponse<Movement> | Movement[]
      >(`/stock-movements${buildOffsetQuery(query)}`, {
        headers: {
          "x-branch-id": effectiveBranchId,
        },
      });
      return toPaginatedResponse(
        payload,
        Number(query.skip ?? query.offset ?? 0),
        Number(query.take ?? query.limit ?? 50)
      );
    },
    history: async (query: MovementQuery = {}, branchIdOverride?: string | null) => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const payload = await apiClientFetch.get<
        PaginatedResponse<Movement> | Movement[]
      >(`/stock-movements/history${buildOffsetQuery(query)}`, {
        headers: {
          "x-branch-id": effectiveBranchId,
        },
      });
      return toPaginatedResponse(
        payload,
        Number(query.skip ?? query.offset ?? 0),
        Number(query.take ?? query.limit ?? 50)
      );
    },
    create: async (body: CreateMovementRequest) => {
      const { branchId: _branchId, ...payload } = body;
      const movement = await apiClientFetch.post<Movement>(
        "/stock-movements",
        payload
      );
      invalidateStockCache(getApiSession().branchId);
      return movement;
    },
    transfer: async (body: TransferMovementRequest) => {
      const activeBranchId = getApiSession().branchId;
      if (!activeBranchId) {
        throw new Error("No hay sucursal activa en la sesion.");
      }

      const payload: TransferMovementRequest = {
        ...body,
        fromBranchId: activeBranchId,
      };
      const movement = await apiClientFetch.post<Movement>(
        "/stock-movements/transfer",
        payload
      );
      invalidateStockCache(payload.fromBranchId);
      invalidateStockCache(payload.toBranchId);
      return movement;
    },
    adjustmentIn: async (body: CreateMovementRequest) => {
      const { branchId: _branchId, ...payload } = body;
      const movement = await apiClientFetch.post<Movement>(
        "/stock-movements/adjustment-in",
        payload
      );
      invalidateStockCache(getApiSession().branchId);
      return movement;
    },
    adjustmentOut: async (body: CreateMovementRequest) => {
      const { branchId: _branchId, ...payload } = body;
      const movement = await apiClientFetch.post<Movement>(
        "/stock-movements/adjustment-out",
        payload
      );
      invalidateStockCache(getApiSession().branchId);
      return movement;
    },
  },
  sales: {
    create: async (body: CreateSaleRequest) => {
      const { branchId: _branchId, ...payload } = body;
      const sale = await apiClientFetch.post<SaleDetail | SaleSummary>(
        "/sales",
        payload
      );
      invalidateStockCache(getApiSession().branchId);
      emitSalesSync(
        (sale as { branchId?: string | null }).branchId ??
          getApiSession().branchId
      );
      return sale;
    },
    list: async (
      query: SaleListQuery = {},
      branchIdOverride?: string | null
    ) => {
      const normalizedQuery = query as SaleListQuery & {
        skip?: number;
        take?: number;
        page?: number;
      };
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const requestOptions = {
        headers: {
          "x-branch-id": effectiveBranchId,
        },
      };
      const payload = await apiClientFetch.get<
        PaginatedResponse<SaleSummary> | SaleSummary[]
      >(`/sales${buildOffsetQuery(normalizedQuery)}`, requestOptions);

      return toPaginatedResponse(
        payload,
        Number(normalizedQuery.skip ?? normalizedQuery.offset ?? 0),
        Number(normalizedQuery.take ?? normalizedQuery.limit ?? 20)
      );
    },
    getById: (id: string) => apiClientFetch.get<SaleDetail>(`/sales/${id}`),
    addPayment: async (id: string, body: SalePaymentInput) => {
      const payment = await apiClientFetch.post<SalePayment>(
        `/sales/${id}/payments`,
        body
      );
      emitSalesSync(getApiSession().branchId);
      return payment;
    },
    paymentsList: async (query: SalePaymentsListQuery = {}) => {
      const normalizedQuery = query as SalePaymentsListQuery & {
        page?: number;
      };
      const fallbackLimit = Number(
        normalizedQuery.limit ?? normalizedQuery.take ?? 20
      );
      const fallbackOffset = Number(
        normalizedQuery.offset ??
          normalizedQuery.skip ??
          (Number(normalizedQuery.page ?? 1) - 1) * fallbackLimit
      );
      const payload = await apiClientFetch.get<
        PaginatedResponse<SalePayment> | SalePayment[]
      >(`/sales/payments/list${buildOffsetQuery(normalizedQuery)}`);
      return toPaginatedResponse(
        payload,
        Math.max(0, fallbackOffset),
        Math.max(1, fallbackLimit)
      );
    },
    cancel: async (id: string) => {
      const result = await apiClientFetch.delete<SaleDetail | SaleSummary | true>(
        `/sales/${id}`
      );
      emitSalesSync(getApiSession().branchId);
      return result;
    },
  },
  reporting: {
    global: {
      metrics: async (
        query: { from: string; to: string },
        branchIdOverride?: string | null
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        const payload = await apiClientFetch.get<unknown>(
          `/reporting/global/metrics${buildQuery(query, {
            preserveLimitAndOffset: true,
          })}`,
          {
            headers: {
              "x-branch-id": effectiveBranchId,
            },
          }
        );

        return normalizeReportingGlobalMetrics(payload);
      },
    },
    dashboard: {
      summary: (
        query: {
          period?: SnapshotPeriod;
          scope?: "active" | "all";
          lowStockThreshold?: number;
        } = {},
        branchIdOverride?: string | null
      ) =>
        apiClientFetch.get<SnapshotMetricsResponse>(
          `/reporting/dashboard/summary${buildQuery({
            period: query.period ?? "monthly",
            scope: query.scope ?? "active",
            lowStockThreshold: query.lowStockThreshold,
          })}`,
          {
            branchScoped: true,
            disableCache: true,
            headers: branchIdOverride
              ? {
                  "x-branch-id": branchIdOverride,
                }
              : undefined,
          }
        ),
    },
    sales: {
      summary: () =>
        apiClientFetch.get<ReportingSalesSummaryResponse>(
          "/reporting/sales/summary"
        ),
      history: (query: AnalyticsSalesQuery) =>
        apiClientFetch.get<AnalyticsSalesResponse>(
          `/reporting/sales/history${buildQuery(query)}`
        ),
      overview: async (
        query: ReportsSalesOverviewQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        const { branchId: ignoredBranchId, ...overviewQuery } = query;
        void ignoredBranchId;

        return withRateLimitRetry(
          () =>
            apiClientFetch.get<ReportsSalesOverviewResponse>(
              `/reporting/sales/overview${buildQuery(overviewQuery, {
                preserveLimitAndOffset: true,
              })}`,
              {
                headers: {
                  "x-branch-id": effectiveBranchId,
                },
                signal: options?.signal,
              }
            ),
          options?.signal
        );
      },
      priceTypes: {
        summary: async (
          query: ReportsSalesPriceTypesSummaryQuery,
          branchIdOverride?: string | null,
          options?: { signal?: AbortSignal }
        ) => {
          const effectiveBranchId =
            branchIdOverride ?? getApiSession().branchId;
          if (!effectiveBranchId) {
            throw new Error("Missing branch context. Send x-branch-id header.");
          }

          const { branchId: ignoredBranchId, ...summaryQuery } = query;
          void ignoredBranchId;

          return withRateLimitRetry(
            () =>
              apiClientFetch
                .get<unknown>(
                  `/reporting/sales/price-types/summary${buildQuery(
                    summaryQuery,
                    {
                      preserveLimitAndOffset: true,
                    }
                  )}`,
                  {
                    headers: {
                      "x-branch-id": effectiveBranchId,
                    },
                    signal: options?.signal,
                  }
                )
                .then(normalizeSalesPriceTypesSummary),
            options?.signal
          );
        },
      },
      pricingSources: {
        summary: async (
          query: ReportsSalesPricingSourcesSummaryQuery,
          branchIdOverride?: string | null,
          options?: { signal?: AbortSignal }
        ) => {
          const effectiveBranchId =
            branchIdOverride ?? getApiSession().branchId;
          if (!effectiveBranchId) {
            throw new Error("Missing branch context. Send x-branch-id header.");
          }

          const { branchId: ignoredBranchId, ...summaryQuery } = query;
          void ignoredBranchId;

          return withRateLimitRetry(
            () =>
              apiClientFetch
                .get<unknown>(
                  `/reporting/sales/pricing-sources/summary${buildQuery(
                    summaryQuery,
                    {
                      preserveLimitAndOffset: true,
                    }
                  )}`,
                  {
                    headers: {
                      "x-branch-id": effectiveBranchId,
                    },
                    signal: options?.signal,
                  }
                )
                .then(normalizeSalesPricingSourcesSummary),
            options?.signal
          );
        },
      },
      topProducts: {
        report: async (
          query: ReportsTopProductsQuery,
          branchIdOverride?: string | null,
          options?: { signal?: AbortSignal }
        ) => {
          const effectiveBranchId =
            branchIdOverride ?? getApiSession().branchId;
          if (!effectiveBranchId) {
            throw new Error("Missing branch context. Send x-branch-id header.");
          }

          const { branchId: ignoredBranchId, ...reportQuery } = query;
          void ignoredBranchId;
          const normalizedLimit = Math.min(
            300,
            Math.max(1, toFiniteNumber(reportQuery.limit, 10))
          );
          const normalizedSearch = toTrimmedOrUndefined(
            reportQuery.search ?? reportQuery.q
          );
          const normalizedOffset = toOptionalFiniteNumber(
            reportQuery.offset ?? reportQuery.skip
          );
          const normalizedPage = toOptionalFiniteNumber(reportQuery.page);
          const normalizedQuery = {
            ...reportQuery,
            limit: normalizedLimit,
            search: normalizedSearch,
            q: undefined,
            offset:
              normalizedOffset !== null && normalizedOffset >= 0
                ? Math.floor(normalizedOffset)
                : undefined,
            skip: undefined,
            page:
              normalizedPage !== null && normalizedPage > 0
                ? Math.floor(normalizedPage)
                : undefined,
          };

          return withRateLimitRetry(
            () =>
              apiClientFetch.get<ReportsTopProductsResponse>(
                `/reporting/sales/top-products/report${buildQuery(
                  normalizedQuery,
                  {
                    preserveLimitAndOffset: true,
                  }
                )}`,
                {
                  headers: {
                    "x-branch-id": effectiveBranchId,
                  },
                  signal: options?.signal,
                }
              ),
            options?.signal
          );
        },
      },
    },
    products: {
      margins: {
        table: async (
          query: ReportsProductMarginsTableQuery,
          branchIdOverride?: string | null,
          options?: { signal?: AbortSignal }
        ) => {
          const effectiveBranchId =
            branchIdOverride ?? getApiSession().branchId;
          if (!effectiveBranchId) {
            throw new Error("Missing branch context. Send x-branch-id header.");
          }

          const { branchId: ignoredBranchId, ...tableQuery } = query;
          void ignoredBranchId;
          const normalizedQuery = {
            ...tableQuery,
            startDate: toTrimmedOrUndefined(tableQuery.startDate),
            endDate: toTrimmedOrUndefined(tableQuery.endDate),
            page: Math.max(1, Math.floor(toFiniteNumber(tableQuery.page, 1))),
            limit: Math.min(
              100,
              Math.max(1, Math.floor(toFiniteNumber(tableQuery.limit, 25)))
            ),
            search: toTrimmedOrUndefined(tableQuery.search),
            categoryId: toTrimmedOrUndefined(tableQuery.categoryId),
          };

          return withRateLimitRetry(
            () =>
              apiClientFetch.get<ReportsProductMarginsTableResponse>(
                `/reporting/products/margins/table${buildQuery(
                  normalizedQuery,
                  {
                    preserveLimitAndOffset: true,
                  }
                )}`,
                {
                  headers: {
                    "x-branch-id": effectiveBranchId,
                  },
                  signal: options?.signal,
                }
              ),
            options?.signal
          );
        },
      },
    },
    inventory: {
      overview: async (
        query: ReportsInventoryOverviewQuery = {},
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        const { branchId: ignoredBranchId, ...overviewQueryRaw } = query;
        void ignoredBranchId;
        const fallbackLimit = Math.min(
          100,
          Math.max(
            1,
            toFiniteNumber(
              overviewQueryRaw.limit ?? overviewQueryRaw.take,
              20
            )
          )
        );
        const fallbackOffset = Math.max(
          0,
          toFiniteNumber(
            overviewQueryRaw.offset ?? overviewQueryRaw.skip,
            0
          )
        );
        const overviewQuery = {
          ...overviewQueryRaw,
          search: toTrimmedOrUndefined(overviewQueryRaw.search),
          categoryId: toTrimmedOrUndefined(overviewQueryRaw.categoryId),
          stockStatus: toTrimmedOrUndefined(overviewQueryRaw.stockStatus),
          page:
            overviewQueryRaw.page ??
            Math.floor(fallbackOffset / fallbackLimit) + 1,
          limit: fallbackLimit,
          offset: undefined,
          skip: undefined,
          take: undefined,
        };

        return withRateLimitRetry(
          async () =>
            toPaginatedItemsResponse<ReportsInventoryOverviewResponse["items"][number]>(
              await getFirstAvailablePath<
                | ReportsInventoryOverviewResponse
                | ReportsInventoryOverviewResponse["items"]
              >(
                [
                  `/reporting/inventory/overview${buildQuery(overviewQuery, {
                    preserveLimitAndOffset: true,
                  })}`,
                  `/reports/inventory/overview${buildQuery(overviewQuery, {
                    preserveLimitAndOffset: true,
                  })}`,
                ],
                {
                  headers: {
                    "x-branch-id": effectiveBranchId,
                  },
                  signal: options?.signal,
                }
              ),
              fallbackOffset,
              fallbackLimit
            ),
          options?.signal
        );
      },
      summary: async (
        query: ReportsInventorySummaryQuery = {},
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        const { branchId: ignoredBranchId, ...summaryQueryRaw } = query;
        void ignoredBranchId;
        const summaryQuery = {
          ...summaryQueryRaw,
          search: toTrimmedOrUndefined(summaryQueryRaw.search),
          categoryId: toTrimmedOrUndefined(summaryQueryRaw.categoryId),
        };

        return withRateLimitRetry(
          () =>
            apiClientFetch.get<ReportsInventorySummaryResponse>(
              `/reporting/inventory/summary${buildQuery(summaryQuery, {
                preserveLimitAndOffset: true,
              })}`,
              {
                headers: {
                  "x-branch-id": effectiveBranchId,
                },
                signal: options?.signal,
              }
            ),
          options?.signal
        );
      },
      lowStock: async (
        query: ReportsInventoryLowStockQuery = {},
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        const { branchId: ignoredBranchId, ...lowStockQueryRaw } = query;
        void ignoredBranchId;
        const lowStockQuery = {
          ...lowStockQueryRaw,
          search: toTrimmedOrUndefined(lowStockQueryRaw.search),
          categoryId: toTrimmedOrUndefined(lowStockQueryRaw.categoryId),
        };

        return withRateLimitRetry(
          () =>
            apiClientFetch.get<ReportsInventoryLowStockResponse>(
              `/reporting/inventory/low-stock${buildQuery(lowStockQuery, {
                preserveLimitAndOffset: true,
              })}`,
              {
                headers: {
                  "x-branch-id": effectiveBranchId,
                },
                signal: options?.signal,
              }
            ),
          options?.signal
        );
      },
    },
    expenses: {
      history: (
        query: {
          period: SnapshotPeriod;
          context?: string;
          category?: string;
          from?: string;
          to?: string;
        },
        branchIdOverride?: string | null
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }
        return apiClientFetch.get<ExpenseAnalyticsResponse>(
          `/reporting/expenses/history${buildQuery(query)}`,
          effectiveBranchId
            ? {
                headers: {
                  "x-branch-id": effectiveBranchId,
                },
              }
            : undefined
        );
      },
      projection: async (
        query: ReportsExpensesProjectionQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        const { branchId: ignoredBranchId, ...projectionQuery } = query;
        void ignoredBranchId;

        return withRateLimitRetry(
          () =>
            apiClientFetch.get<ReportsExpensesProjectionResponse>(
              `/reporting/expenses/projection${buildQuery(projectionQuery, {
                preserveLimitAndOffset: true,
              })}`,
              {
                headers: {
                  "x-branch-id": effectiveBranchId,
                },
                signal: options?.signal,
              }
            ),
          options?.signal
        );
      },
    },
    cash: {
      overview: async (
        query: ReportsCashOverviewQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        const { branchId: ignoredBranchId, ...overviewQuery } = query;
        void ignoredBranchId;

        return withRateLimitRetry(
          () =>
            getFirstAvailablePath<ReportsCashOverviewResponse>(
              [
                `/reporting/cash/overview${buildQuery(overviewQuery, {
                  preserveLimitAndOffset: true,
                })}`,
                `/reports/cash/overview${buildQuery(overviewQuery, {
                  preserveLimitAndOffset: true,
                })}`,
              ],
              {
                headers: {
                  "x-branch-id": effectiveBranchId,
                },
                signal: options?.signal,
              }
            ),
          options?.signal
        );
      },
      monthly: async (
        query: ReportsCashMonthlyQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        const { branchId: ignoredBranchId, ...monthlyQuery } = query;
        void ignoredBranchId;

        return withRateLimitRetry(
          () =>
            apiClientFetch.get<ReportsCashMonthlyResponse>(
              `/reporting/cash/monthly${buildQuery(monthlyQuery, {
                preserveLimitAndOffset: true,
              })}`,
              {
                headers: {
                  "x-branch-id": effectiveBranchId,
                },
                signal: options?.signal,
              }
            ),
          options?.signal
        );
      },
    },
  },
  snapshots: {
    metrics: (period: SnapshotPeriod = "monthly") =>
      backendApi.reporting.dashboard.summary({
        period,
        scope: "active",
      }),
  },
  expenses: {
    create: (body: CreateExpenseRequest) => {
      const { branchId: _branchId, ...payload } = body;
      return apiClientFetch
        .post<Expense>("/expenses", payload)
        .then((created) => {
          emitExpensesSync(
            created.branchId ?? getApiSession().branchId
          );
          return created;
        });
    },
    list: async (
      query: ExpenseListQuery = {},
      branchIdOverride?: string | null
    ) => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const payload = await apiClientFetch.get<
        PaginatedResponse<Expense> | Expense[]
      >(
        `/expenses${buildOffsetQuery(query)}`,
        effectiveBranchId
          ? {
              headers: {
                "x-branch-id": effectiveBranchId,
              },
            }
          : undefined
      );
      return toPaginatedResponse(
        payload,
        Number(query.skip ?? query.offset ?? 0),
        Number(query.take ?? query.limit ?? 20)
      );
    },
    analytics: (
      query: {
        period: SnapshotPeriod;
        context?: string;
        category?: string;
        from?: string;
        to?: string;
      },
      branchIdOverride?: string | null
    ) => backendApi.reporting.expenses.history(query, branchIdOverride),
    getById: (id: string) => apiClientFetch.get<Expense>(`/expenses/${id}`),
    remove: async (id: string) => {
      const deleted = await apiClientFetch.delete<true>(`/expenses/${id}`);
      emitExpensesSync(getApiSession().branchId);
      return deleted;
    },
  },
  cash: {
    openSession: async (body: OpenCashSessionRequest) => {
      const session = await apiClientFetch.post<CashSession>(
        "/cash/sessions/open",
        body
      );
      emitCashSync(session.branchId ?? getApiSession().branchId);
      return session;
    },
    addMovement: async (
      sessionId: string,
      body: CreateCashMovementRequest
    ) => {
      const session = await apiClientFetch.post<CashSession>(
        `/cash/sessions/${sessionId}/movements`,
        body
      );
      emitCashSync(session.branchId ?? getApiSession().branchId);
      return session;
    },
    closeSession: async (sessionId: string, body: CloseCashSessionRequest) => {
      const session = await apiClientFetch.post<CashSession>(
        `/cash/sessions/${sessionId}/close`,
        body
      );
      emitCashSync(session.branchId ?? getApiSession().branchId);
      return session;
    },
    getCurrentSessionSnapshot: async (
      query: CashSessionSnapshotRequest = {}
    ): Promise<CashSessionSnapshotResponse> => {
      const effectiveBranchId =
        query.branchIdOverride ?? getApiSession().branchId;
      const headers: Record<string, string> = {};

      if (effectiveBranchId) {
        headers["x-branch-id"] = effectiveBranchId;
      }

      const etag = query.etag?.trim();
      if (etag) {
        headers["If-None-Match"] = etag;
      }

      const response = await apiClientFetch.getWithMetadata<CashSession | null>(
        "/cash/sessions/current",
        {
          headers,
        },
        [304]
      );

      if (response.status === 304) {
        return {
          status: 304,
          session: null,
          etag: response.headers.get("ETag"),
          lastModified: response.headers.get("Last-Modified"),
        };
      }

      return {
        status: 200,
        session: response.data ?? null,
        etag: response.headers.get("ETag"),
        lastModified: response.headers.get("Last-Modified"),
      };
    },
    getCurrentSummary: async (
      branchIdOverride?: string | null
    ): Promise<CashCurrentSummaryResponse> => {
      const requestOptions = branchIdOverride
        ? {
            headers: {
              "x-branch-id": branchIdOverride,
            },
          }
        : undefined;

      try {
        const payload = await apiClientFetch.get<unknown>(
          "/cash/sessions/current/summary",
          requestOptions
        );
        return normalizeCashCurrentSummary(payload);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) {
          throw error;
        }

        const response =
          await apiClientFetch.getWithMetadata<CashSession | null>(
            "/cash/sessions/current",
            requestOptions
          );
        const session = response.data ?? null;
        const hasOpenSession = Boolean(session && session.status === "OPEN");

        return {
          hasOpenSession,
          session: hasOpenSession ? session : null,
          branchId: session?.branchId ?? branchIdOverride ?? null,
          updatedAt: session?.lastActivityAt ?? null,
        };
      }
    },
    getCurrentSession: (branchIdOverride?: string | null) => {
      const requestOptions = branchIdOverride
        ? {
            headers: {
              "x-branch-id": branchIdOverride,
            },
          }
        : undefined;

      return apiClientFetch
        .getWithMetadata<CashSession | null>(
          "/cash/sessions/current",
          requestOptions
        )
        .then((response) => response.data ?? null);
    },
    listSessions: async (
      query: {
        from?: string;
        to?: string;
        skip?: number;
        take?: number;
        offset?: number;
        page?: number;
        limit?: number;
      } = {},
      branchIdOverride?: string | null
    ) => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }

      const requestOptions = effectiveBranchId
        ? {
            headers: {
              "x-branch-id": effectiveBranchId,
            },
          }
        : undefined;

      const payload = await apiClientFetch.get<
        PaginatedResponse<CashSession> | CashSession[]
      >(`/cash/sessions${buildOffsetQuery(query)}`, requestOptions);

      return toPaginatedResponse(
        payload,
        Number(query.skip ?? query.offset ?? 0),
        Number(query.take ?? query.limit ?? 20)
      );
    },
    dailyBook: async (
      query: CashBookDailyQuery = {},
      branchIdOverride?: string | null
    ) => {
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const fallbackLimit = Math.min(
        100,
        Math.max(1, toFiniteNumber(query.take ?? query.limit, 20))
      );
      const fallbackOffset = Math.max(
        0,
        toFiniteNumber(query.skip ?? query.offset, 0)
      );
      const fallbackPage = Math.max(
        1,
        toFiniteNumber(
          query.page,
          Math.floor(fallbackOffset / fallbackLimit) + 1
        )
      );

      const safeQuery = {
        date: query.date,
        page: fallbackPage,
        limit: fallbackLimit,
      };
      const requestedDate = extractDateKey(safeQuery.date);
      const requestOptions = effectiveBranchId
        ? {
            headers: {
              "x-branch-id": effectiveBranchId,
            },
          }
        : undefined;
      const payload = await apiClientFetch.get<Record<string, unknown>>(
        `/cash/book/daily${buildQuery(safeQuery, {
          preserveLimitAndOffset: true,
        })}`,
        requestOptions
      );

      const entriesPayload = payload.entries ?? payload.items ?? [];
      let entries: PaginatedResponse<CashBookEntry>;

      if (Array.isArray(entriesPayload)) {
        const normalizedItems = entriesPayload.map((entry, index) =>
          normalizeCashBookEntry(entry, index)
        );
        entries = {
          items: normalizedItems,
          meta: normalizeOffsetMeta(
            payload.meta,
            fallbackOffset,
            fallbackLimit,
            normalizedItems.length
          ),
        };
      } else {
        const paginatedEntries = toPaginatedResponse(
          entriesPayload as
            | PaginatedResponse<Record<string, unknown>>
            | Record<string, unknown>[],
          fallbackOffset,
          fallbackLimit
        );

        entries = {
          ...paginatedEntries,
          items: paginatedEntries.items.map((entry, index) =>
            normalizeCashBookEntry(entry, index)
          ),
        };
      }

      const summarySource = asRecord(payload.summary ?? payload);
      const incomeSource = asRecord(summarySource.income);
      const outflowSource = asRecord(summarySource.outflow);
      const breakdownSource = asRecord(
        payload.breakdown ?? payload.paymentBreakdown ?? payload.byMethod ?? {}
      );

      const openingFloat = toFiniteNumber(
        summarySource.openingFloat ?? summarySource.opening,
        0
      );
      const expectedCash = toFiniteNumber(
        summarySource.expectedCash ?? summarySource.expected,
        0
      );
      const countedCash = toOptionalFiniteNumber(
        summarySource.countedCash ?? summarySource.counted
      );
      const difference = toOptionalFiniteNumber(summarySource.difference);
      const cashFromPayments = toFiniteNumber(
        incomeSource.cashFromPayments ??
          summarySource.cashFromPayments ??
          breakdownSource.cash ??
          breakdownSource.efectivo,
        0
      );
      const transferFromPayments = toFiniteNumber(
        incomeSource.transferFromPayments ??
          summarySource.transferFromPayments ??
          breakdownSource.transfer ??
          breakdownSource.transfers ??
          breakdownSource.transferencia,
        0
      );
      const movementIn = toFiniteNumber(
        incomeSource.movementIn ?? summarySource.movementIn,
        0
      );
      const movementOut = toFiniteNumber(
        outflowSource.movementOut ?? summarySource.movementOut,
        0
      );
      const movementBalance = toFiniteNumber(
        summarySource.movementBalance,
        movementIn - movementOut
      );
      const differenceSource =
        toOptionalText(summarySource.differenceSource) ?? undefined;

      let sessionsRaw = Array.isArray(payload.sessions)
        ? payload.sessions
        : [];
      let entriesItems = entries.items;

      if (requestedDate) {
        const nextUtcDate = shiftYmdDate(requestedDate, 1);
        if (nextUtcDate) {
          try {
            const adjacentPayload = await apiClientFetch.get<
              Record<string, unknown>
            >(
              `/cash/book/daily${buildQuery(
                {
                  date: nextUtcDate,
                  page: 1,
                  limit: 100,
                },
                {
                  preserveLimitAndOffset: true,
                }
              )}`,
              requestOptions
            );

            const adjacentSessionsRaw = Array.isArray(adjacentPayload.sessions)
              ? adjacentPayload.sessions
              : [];
            if (adjacentSessionsRaw.length > 0) {
              sessionsRaw = [...sessionsRaw, ...adjacentSessionsRaw];
            }

            const adjacentEntriesPayload =
              adjacentPayload.entries ?? adjacentPayload.items ?? [];
            if (Array.isArray(adjacentEntriesPayload) && adjacentEntriesPayload.length > 0) {
              const normalizedAdjacentEntries = adjacentEntriesPayload.map(
                (entry, index) =>
                  normalizeCashBookEntry(entry, entriesItems.length + index)
              );
              entriesItems = [...entriesItems, ...normalizedAdjacentEntries];
            }
          } catch {
            // Ignore adjacent day failures; primary day payload already loaded.
          }
        }
      }

      const normalizedSessions = sessionsRaw
        .map((s) => normalizeCashSessionFromUnknown(s))
        .filter((s): s is CashSession => s !== null);
      const sessionsById = new Map<string, CashSession>();
      normalizedSessions.forEach((session) => {
        if (!sessionsById.has(session.id)) {
          sessionsById.set(session.id, session);
        }
      });
      const sessions = Array.from(sessionsById.values())
        .filter((session) => {
          if (!requestedDate) return true;
          const openedDate = extractDateKey(session.openedAt);
          const closedDate = extractDateKey(session.closedAt);

          if (!openedDate && !closedDate) return false;
          if (openedDate && closedDate) {
            return openedDate <= requestedDate && closedDate >= requestedDate;
          }
          if (openedDate && !closedDate) {
            return openedDate <= requestedDate;
          }
          return closedDate === requestedDate;
        })
        .sort((a, b) => {
          const openedA = new Date(a.openedAt ?? 0).getTime();
          const openedB = new Date(b.openedAt ?? 0).getTime();
          return openedB - openedA;
        });

      const entriesByDate = entriesItems
        .filter((entry) => {
          if (!requestedDate) return true;
          return extractDateKey(entry.createdAt) === requestedDate;
        })
        .reduce<CashBookEntry[]>((acc, entry) => {
          if (acc.some((current) => current.id === entry.id)) return acc;
          acc.push(entry);
          return acc;
        }, [])
        .sort((a, b) => {
          const createdA = new Date(a.createdAt ?? 0).getTime();
          const createdB = new Date(b.createdAt ?? 0).getTime();
          return createdB - createdA;
        });

      return {
        branchId: effectiveBranchId,
        date:
          requestedDate ??
          extractDateKey(payload.date) ??
          new Date().toISOString().slice(0, 10),
        summary: {
          openingFloat,
          expectedCash,
          countedCash,
          difference,
          differenceSource,
          movementBalance,
          income: {
            cashFromPayments,
            transferFromPayments,
            movementIn,
          },
          outflow: {
            movementOut,
          },
        },
        sessions,
        entries: entriesByDate,
        meta: entries.meta,
      } satisfies CashBookDailyResponse;
    },
  },
  analytics: {
    sales: (query: AnalyticsSalesQuery) =>
      backendApi.reporting.sales.history(query),
  },
  reports: {
    products: {
      marginsTable: async (
        query: ReportsProductMarginsTableQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) =>
        backendApi.reporting.products.margins.table(
          query,
          branchIdOverride,
          options
        ),
    },
    sales: {
      priceTypes: async (
        query: ReportsSalesPriceTypesSummaryQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) =>
        backendApi.reporting.sales.priceTypes.summary(
          query,
          branchIdOverride,
          options
        ),
      pricingSources: async (
        query: ReportsSalesPricingSourcesSummaryQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) =>
        backendApi.reporting.sales.pricingSources.summary(
          query,
          branchIdOverride,
          options
        ),
      topProducts: async (
        query: ReportsTopProductsQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) =>
        backendApi.reporting.sales.topProducts.report(
          query,
          branchIdOverride,
          options
        ),
    },
    inventory: {
      overview: async (
        query: ReportsInventoryOverviewQuery = {},
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => backendApi.reporting.inventory.overview(query, branchIdOverride, options),
      summary: async (
        query: ReportsInventorySummaryQuery = {},
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) =>
        backendApi.reporting.inventory.summary(
          query,
          branchIdOverride,
          options
        ),
      lowStock: async (
        query: ReportsInventoryLowStockQuery = {},
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) =>
        backendApi.reporting.inventory.lowStock(
          query,
          branchIdOverride,
          options
        ),
    },
    expenses: {
      projection: async (
        query: ReportsExpensesProjectionQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) =>
        backendApi.reporting.expenses.projection(
          query,
          branchIdOverride,
          options
        ),
    },
    cash: {
      overview: async (
        query: ReportsCashOverviewQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => backendApi.reporting.cash.overview(query, branchIdOverride, options),
      monthly: async (
        query: ReportsCashMonthlyQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => backendApi.reporting.cash.monthly(query, branchIdOverride, options),
    },
  },
  audit: {
    list: async (query: AuditQuery = {}) => {
      const payload = await apiClientFetch.get<
        PaginatedResponse<AuditLog> | AuditLog[]
      >(`/audit${buildOffsetQuery(query)}`, { branchScoped: false });

      return toPaginatedResponse(
        payload,
        Number(query.skip ?? query.offset ?? 0),
        Number(query.take ?? query.limit ?? 50)
      );
    },
    byEntity: async (entityType: string, entityId?: string) => {
      const payload = await apiClientFetch.get<
        PaginatedResponse<AuditLog> | AuditLog[]
      >(`/audit/entity/${entityType}${buildQuery({ entityId })}`, {
        branchScoped: false,
      });
      return toPaginatedResponse(payload, 0, 50);
    },
    byUser: async (userId: string) => {
      const payload = await apiClientFetch.get<
        PaginatedResponse<AuditLog> | AuditLog[]
      >(`/audit/user/${userId}`, { branchScoped: false });
      return toPaginatedResponse(payload, 0, 50);
    },
  },
  productsWithStock: async (
    query: ProductsQuery = {},
    branchIdOverride?: string | null,
    options?: { signal?: AbortSignal }
  ) => {
    const normalizedSearch = toTrimmedOrUndefined(
      query.search ?? query.q ?? query.name
    );
    const normalizedQuery: ProductsQuery = {
      ...query,
      skip: query.skip ?? query.offset,
      take: query.take ?? query.limit,
      name: normalizedSearch,
      q: normalizedSearch,
      search: normalizedSearch,
    };

    const explicitBranchId = branchIdOverride ?? null;
    const productsPayload = await backendApi.products.list(
      normalizedQuery,
      explicitBranchId,
      options
    );
    const take = Number(normalizedQuery.take ?? normalizedQuery.limit ?? 20);
    const skip = Number(normalizedQuery.skip ?? normalizedQuery.offset ?? 0);
    const hasMore =
      productsPayload.meta.hasMore ??
      productsPayload.meta.offset + productsPayload.meta.limit <
        productsPayload.meta.total;
    const normalizedPage: NormalizedProductsPage = {
      items: productsPayload.items,
      total: productsPayload.meta.total,
      skip: productsPayload.meta.offset ?? skip,
      take: productsPayload.meta.limit ?? take,
      nextSkip: hasMore
        ? (productsPayload.meta.offset ?? skip) +
          (productsPayload.meta.limit ?? take)
        : null,
      hasMore,
    };
    const scopedBranchId = explicitBranchId ?? getApiSession().branchId;

    if (!scopedBranchId) return normalizedPage;

    const allRowsHaveStock = normalizedPage.items.every(
      (item) => readItemStock(item) !== null
    );
    const hasSharedStockProducts = normalizedPage.items.some((item) => {
      const productId = String(item.id ?? "").trim();
      const baseProductId = String(item.stockBaseProductId ?? "").trim();
      return Boolean(
        item.trackStock !== false &&
          productId &&
          baseProductId &&
          baseProductId !== productId
      );
    });
    if (allRowsHaveStock && !hasSharedStockProducts) {
      return {
        ...normalizedPage,
        items: normalizedPage.items.map((item) =>
          applyStockToProduct(item, undefined, scopedBranchId)
        ),
      } satisfies NormalizedProductsPage;
    }

    const stocks = await getCachedStocksForBranch(scopedBranchId);
    const stockContext = buildStockResolverContext(stocks);

    return {
      ...normalizedPage,
      items: normalizedPage.items.map((item) =>
        applyStockToProduct(item, stockContext, scopedBranchId)
      ),
    } satisfies NormalizedProductsPage;
  },
  productByBarcodeWithStock: async (code: string) => {
    const resolved = await backendApi.products.resolveBarcode(code);
    return resolved.product;
  },
  commercialIntelligence: {
    summary: () =>
      apiClientFetch.get<CISummaryResponse>("/commercial-intelligence/summary", {
        branchScoped: true,
      }),
    pareto: (query: CIParetoQuery = {}) =>
      apiClientFetch.get<CIParetoResponse>(
        `/commercial-intelligence/pareto${buildQuery(query, { preserveLimitAndOffset: true })}`,
        { branchScoped: true }
      ),
    slowMovers: (query: CISlowMoversQuery = {}) =>
      apiClientFetch.get<CISlowMoversResponse>(
        `/commercial-intelligence/slow-movers${buildQuery(query, { preserveLimitAndOffset: true })}`,
        { branchScoped: true }
      ),
    hourlySales: (query: CIHourlySalesQuery = {}) =>
      apiClientFetch.get<CIHourlySalesResponse>(
        `/commercial-intelligence/hourly-sales${buildQuery(query, { preserveLimitAndOffset: true })}`,
        { branchScoped: true }
      ),
    productVelocity: (query: CIVelocityQuery = {}) =>
      apiClientFetch.get<CIVelocityResponse>(
        `/commercial-intelligence/product-velocity${buildQuery(query, { preserveLimitAndOffset: true })}`,
        { branchScoped: true }
      ),
    stockBreaks: (query: CIStockBreaksQuery = {}) =>
      apiClientFetch.get<CIStockBreaksResponse>(
        `/commercial-intelligence/stock-breaks${buildQuery(query, { preserveLimitAndOffset: true })}`,
        { branchScoped: true }
      ),
  },
};
