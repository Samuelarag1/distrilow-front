import { ApiError, apiClientFetch, getApiSession } from "@/lib/api-client";
import { emitExpensesSync } from "@/lib/expenses-live-sync";
import { emitProductsSync } from "@/lib/products-live-sync";
import type {
  AnalyticsSalesQuery,
  AnalyticsSalesResponse,
  AuditLog,
  AuditQuery,
  AuthResponse,
  BarcodeLookupResponse,
  BootstrapBranchResponse,
  Branch,
  CashBookEntry,
  CashBookDailyQuery,
  CashBookDailyResponse,
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
  Movement,
  MovementQuery,
  OffsetPaginationMeta,
  OpenCashSessionRequest,
  PaginatedResponse,
  Product,
  ProductListItem,
  ProductPriceCostHistoryQuery,
  ProductPriceCostHistoryRow,
  ProductReviewPendingQuery,
  ProductsListResponse,
  ProductsQuery,
  RefreshRequest,
  ReportsCashMonthlyQuery,
  ReportsCashMonthlyResponse,
  ReportsExpensesProjectionQuery,
  ReportsExpensesProjectionResponse,
  ReportsInventoryLowStockQuery,
  ReportsInventoryLowStockResponse,
  ReportsInventorySummaryQuery,
  ReportsInventorySummaryResponse,
  ReportsTopProductsQuery,
  ReportsTopProductsResponse,
  Sale,
  SaleListQuery,
  SalePayment,
  SalePaymentInput,
  SalePaymentsListQuery,
  SessionResponse,
  SnapshotPeriod,
  SnapshotMetricsResponse,
  Stock,
  StockSummaryResponse,
  StockQuery,
  SwitchBranchRequest,
  TransferMovementRequest,
  UpdateBranchRequest,
  UpdateCategoryRequest,
  UpdateProductRequest,
  UpdateProductReviewFlagsRequest,
  UpdateResult,
  UpdateUserBranchesRequest,
  UpdateUserRequest,
  UploadImageResponse,
  User,
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
  barcodeType?: string;
}

const STOCK_CACHE_TTL_MS = 10_000;
const stockCacheByBranch = new Map<
  string,
  { cachedAt: number; rows: Stock[] }
>();

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

function mapStockByProduct(stocks: Stock[]) {
  const stockByProductId = new Map<string, number>();
  stocks.forEach((stock) => {
    stockByProductId.set(stock.productId, Number(stock.quantity ?? 0));
  });
  return stockByProductId;
}

function readItemStock(item: ProductListItem) {
  const value = Number((item as Product).stock);
  return Number.isFinite(value) ? value : null;
}

function applyStockToProduct(
  item: ProductListItem,
  stockByProductId: Map<string, number>,
  branchId?: string | null
) {
  return {
    ...item,
    branchId: item.branchId ?? branchId ?? null,
    stock: stockByProductId.get(item.id) ?? readItemStock(item) ?? 0,
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

function normalizeBarcodePayload(
  payload: BarcodeLookupResponse
): ResolvedBarcodeProduct {
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
    };
    return {
      product: barcodePayload.product,
      quantity: toFiniteNumber(barcodePayload.quantity, NaN),
      unitPrice: toFiniteNumber(barcodePayload.unitPrice, NaN),
      subtotal: toFiniteNumber(barcodePayload.subtotal, NaN),
      barcodeType:
        typeof barcodePayload.barcodeType === "string"
          ? barcodePayload.barcodeType
          : undefined,
    };
  }

  return {
    product: payload as ProductListItem,
  };
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

function toOptionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = toFiniteNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCashBookEntry(row: unknown, index: number): CashBookEntry {
  const source = asRecord(row);
  const sourceType = toOptionalText(source.sourceType);
  const direction = toOptionalText(source.direction);
  const legacyType = toOptionalText(source.type);

  const idCandidate = toOptionalText(source.id);
  const id = idCandidate ?? `cash-entry-${index}`;

  const combinedType = [sourceType, direction]
    .filter((value): value is string => Boolean(value))
    .join(" / ");
  const typeLabel =
    legacyType ?? (combinedType.length > 0 ? combinedType : "MOVEMENT");

  const description =
    toOptionalText(source.description) ??
    toOptionalText(source.notes) ??
    toOptionalText(source.reference) ??
    direction ??
    sourceType ??
    null;

  return {
    id,
    type: typeLabel,
    amount: toFiniteNumber(source.amount, 0),
    method: toOptionalText(source.method),
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
  const categories = asRecord(source.categories);

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
    categories: {
      total: toFiniteNumber(categories.total, 0),
      withProducts: toFiniteNumber(categories.withProducts, 0),
      withStock: toFiniteNumber(categories.withStock, 0),
    },
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
      emitProductsSync(created.branchId ?? body.branchId ?? getApiSession().branchId);
      return created;
    },
    resolveBarcode: async (code: string) => {
      const payload = await apiClientFetch.get<BarcodeLookupResponse>(
        `/products/barcode/${code}`
      );
      const normalized = normalizeBarcodePayload(payload);
      const { branchId } = getApiSession();
      if (!branchId) return normalized;

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
      branchIdOverride?: string | null
    ) => {
      const fallbackOffset = Number(query.offset ?? query.skip ?? 0);
      const fallbackLimit = Number(query.limit ?? query.take ?? 20);
      const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
      if (!effectiveBranchId) {
        throw new Error("Missing branch context. Send x-branch-id header.");
      }
      const payload = await apiClientFetch.get<ProductsListResponse>(
        `/products${buildQuery(query)}`,
        effectiveBranchId
          ? {
              headers: {
                "x-branch-id": effectiveBranchId,
              },
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

      const page = normalizeProductsPage(payload, query);
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
      emitProductsSync(updated?.branchId ?? body.branchId ?? getApiSession().branchId);
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
      const payload: CreateStockRequest = {
        ...body,
        branchId: body.branchId ?? requireActiveBranchId(),
      };
      const created = await apiClientFetch.post<Stock>("/stocks", payload);
      invalidateStockCache(payload.branchId);
      return created;
    },
    list: async (query: StockQuery = {}) => {
      const payload = await apiClientFetch.get<
        PaginatedResponse<Stock> | Stock[]
      >(`/stocks${buildQuery(query)}`);
      return toPaginatedResponse(
        payload,
        Number(query.skip ?? query.offset ?? 0),
        Number(query.take ?? query.limit ?? 100)
      );
    },
    listByBranch: async (branchId: string) => {
      const payload = await apiClientFetch.get<
        PaginatedResponse<Stock> | Stock[] | { items?: Stock[] | null }
      >(`/stocks/branch/${branchId}`);

      if (Array.isArray(payload)) {
        return payload;
      }

      if (
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { items?: unknown }).items)
      ) {
        return (payload as { items: Stock[] }).items;
      }

      return [];
    },
    getByBranchAndProduct: (branchId: string, productId: string) =>
      apiClientFetch.get<Stock>(
        `/stocks/branch/${branchId}/product/${productId}`
      ),
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
  },
  stockMovements: {
    list: async (query: MovementQuery = {}) => {
      const payload = await apiClientFetch.get<
        PaginatedResponse<Movement> | Movement[]
      >(`/stock-movements${buildQuery(query)}`);
      return toPaginatedResponse(
        payload,
        Number(query.skip ?? query.offset ?? 0),
        Number(query.take ?? query.limit ?? 50)
      );
    },
    history: async (query: MovementQuery = {}) => {
      const payload = await apiClientFetch.get<
        PaginatedResponse<Movement> | Movement[]
      >(`/stock-movements/history${buildQuery(query)}`);
      return toPaginatedResponse(
        payload,
        Number(query.skip ?? query.offset ?? 0),
        Number(query.take ?? query.limit ?? 50)
      );
    },
    create: async (body: CreateMovementRequest) => {
      const payload: CreateMovementRequest = {
        ...body,
        branchId: body.branchId ?? requireActiveBranchId(),
      };
      const movement = await apiClientFetch.post<Movement>(
        "/stock-movements",
        payload
      );
      invalidateStockCache(payload.branchId);
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
      const payload: CreateMovementRequest = {
        ...body,
        branchId: body.branchId ?? requireActiveBranchId(),
      };
      const movement = await apiClientFetch.post<Movement>(
        "/stock-movements/adjustment-in",
        payload
      );
      invalidateStockCache(payload.branchId);
      return movement;
    },
    adjustmentOut: async (body: CreateMovementRequest) => {
      const payload: CreateMovementRequest = {
        ...body,
        branchId: body.branchId ?? requireActiveBranchId(),
      };
      const movement = await apiClientFetch.post<Movement>(
        "/stock-movements/adjustment-out",
        payload
      );
      invalidateStockCache(payload.branchId);
      return movement;
    },
  },
  sales: {
    create: async (body: CreateSaleRequest) => {
      const payload: CreateSaleRequest = {
        ...body,
        branchId: body.branchId ?? requireActiveBranchId(),
      };
      const sale = await apiClientFetch.post<Sale>("/sales", payload);
      invalidateStockCache(payload.branchId);
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
        PaginatedResponse<Sale> | Sale[]
      >(`/sales${buildOffsetQuery(normalizedQuery)}`, requestOptions);

      return toPaginatedResponse(
        payload,
        Number(normalizedQuery.skip ?? normalizedQuery.offset ?? 0),
        Number(normalizedQuery.take ?? normalizedQuery.limit ?? 20)
      );
    },
    getById: (id: string) => apiClientFetch.get<Sale>(`/sales/${id}`),
    addPayment: (id: string, body: SalePaymentInput) =>
      apiClientFetch.post<SalePayment>(`/sales/${id}/payments`, body),
    paymentsList: async (query: SalePaymentsListQuery = {}) => {
      const payload = await apiClientFetch.get<
        PaginatedResponse<SalePayment> | SalePayment[]
      >(`/sales/payments/list${buildQuery(query)}`);
      return toPaginatedResponse(
        payload,
        Number(query.skip ?? query.offset ?? 0),
        Number(query.take ?? query.limit ?? 20)
      );
    },
    cancel: (id: string) => apiClientFetch.delete<Sale | true>(`/sales/${id}`),
  },
  snapshots: {
    metrics: (period: SnapshotPeriod = "monthly") =>
      apiClientFetch.get<SnapshotMetricsResponse>(
        `/snapshots/metrics${buildQuery({ period })}`,
        { branchScoped: true }
      ),
  },
  expenses: {
    create: (body: CreateExpenseRequest) => {
      const { context: ignoredContext, ...restBody } = body;
      void ignoredContext;
      const payload: CreateExpenseRequest = {
        ...restBody,
        branchId: body.branchId ?? requireActiveBranchId(),
      };
      return apiClientFetch.post<Expense>("/expenses", payload).then((created) => {
        emitExpensesSync(created.branchId ?? payload.branchId ?? getApiSession().branchId);
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
        `/expenses/analytics${buildQuery(query)}`,
        effectiveBranchId
          ? {
              headers: {
                "x-branch-id": effectiveBranchId,
              },
            }
          : undefined
      );
    },
    getById: (id: string) => apiClientFetch.get<Expense>(`/expenses/${id}`),
    remove: async (id: string) => {
      const deleted = await apiClientFetch.delete<true>(`/expenses/${id}`);
      emitExpensesSync(getApiSession().branchId);
      return deleted;
    },
  },
  cash: {
    openSession: (body: OpenCashSessionRequest) =>
      apiClientFetch.post<CashSession>("/cash/sessions/open", body),
    addMovement: (sessionId: string, body: CreateCashMovementRequest) =>
      apiClientFetch.post<CashSession>(
        `/cash/sessions/${sessionId}/movements`,
        body
      ),
    closeSession: (sessionId: string, body: CloseCashSessionRequest) =>
      apiClientFetch.post<CashSession>(
        `/cash/sessions/${sessionId}/close`,
        body
      ),
    getCurrentSession: () =>
      apiClientFetch.get<CashSession | null>("/cash/sessions/current"),
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
      const safeQuery = {
        date: query.date,
      };
      const payload = await apiClientFetch.get<Record<string, unknown>>(
        `/cash/book/daily${buildQuery(safeQuery)}`,
        effectiveBranchId
          ? {
              headers: {
                "x-branch-id": effectiveBranchId,
              },
            }
          : undefined
      );

      const fallbackOffset = Number(query.skip ?? query.offset ?? 0);
      const fallbackLimit = Number(query.take ?? query.limit ?? 30);

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

      return {
        date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
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
        entries,
      } satisfies CashBookDailyResponse;
    },
  },
  analytics: {
    sales: (query: AnalyticsSalesQuery) =>
      apiClientFetch.get<AnalyticsSalesResponse>(
        `/analytics/sales${buildQuery(query)}`
      ),
  },
  reports: {
    sales: {
      topProducts: async (
        query: ReportsTopProductsQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        return withRateLimitRetry(
          () =>
            apiClientFetch.get<ReportsTopProductsResponse>(
              `/reports/sales/top-products${buildQuery(query, {
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
    inventory: {
      summary: async (
        query: ReportsInventorySummaryQuery = {},
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        return withRateLimitRetry(
          () =>
            apiClientFetch.get<ReportsInventorySummaryResponse>(
              `/reports/inventory/summary${buildQuery(query, {
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

        return withRateLimitRetry(
          () =>
            apiClientFetch.get<ReportsInventoryLowStockResponse>(
              `/reports/inventory/low-stock${buildQuery(query, {
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
      projection: async (
        query: ReportsExpensesProjectionQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        return withRateLimitRetry(
          () =>
            apiClientFetch.get<ReportsExpensesProjectionResponse>(
              `/reports/expenses/projection${buildQuery(query, {
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
      monthly: async (
        query: ReportsCashMonthlyQuery,
        branchIdOverride?: string | null,
        options?: { signal?: AbortSignal }
      ) => {
        const effectiveBranchId = branchIdOverride ?? getApiSession().branchId;
        if (!effectiveBranchId) {
          throw new Error("Missing branch context. Send x-branch-id header.");
        }

        return withRateLimitRetry(
          () =>
            apiClientFetch.get<ReportsCashMonthlyResponse>(
              `/reports/cash/monthly${buildQuery(query, {
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
    branchIdOverride?: string | null
  ) => {
    const normalizedQuery: ProductsQuery = {
      ...query,
      skip: query.skip ?? query.offset,
      take: query.take ?? query.limit,
      name: query.name ?? query.search ?? query.q,
      q: query.q ?? query.search ?? query.name,
      search: query.search ?? query.q ?? query.name,
    };

    const explicitBranchId = branchIdOverride ?? null;
    const productsPayload = await backendApi.products.list(
      normalizedQuery,
      explicitBranchId
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
    if (allRowsHaveStock) {
      const emptyStockMap = new Map<string, number>();
      return {
        ...normalizedPage,
        items: normalizedPage.items.map((item) =>
          applyStockToProduct(item, emptyStockMap, scopedBranchId)
        ),
      } satisfies NormalizedProductsPage;
    }

    const stocks = await getCachedStocksForBranch(scopedBranchId);
    const stockByProductId = mapStockByProduct(stocks);

    return {
      ...normalizedPage,
      items: normalizedPage.items.map((item) =>
        applyStockToProduct(item, stockByProductId, scopedBranchId)
      ),
    } satisfies NormalizedProductsPage;
  },
  productByBarcodeWithStock: async (code: string) => {
    const resolved = await backendApi.products.resolveBarcode(code);
    return resolved.product;
  },
};
