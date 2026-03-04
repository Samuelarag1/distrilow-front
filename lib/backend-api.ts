import { apiClientFetch, getApiSession } from "@/lib/api-client";
import type {
  AnalyticsSalesQuery,
  AnalyticsSalesResponse,
  AuditLog,
  AuthResponse,
  BootstrapBranchResponse,
  Branch,
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
  LogoutRequest,
  LogoutResponse,
  LoginRequest,
  Movement,
  OpenCashSessionRequest,
  Product,
  ProductListItem,
  ProductsListResponse,
  ProductsQuery,
  RefreshRequest,
  SessionResponse,
  SwitchBranchRequest,
  Sale,
  SnapshotMetricsResponse,
  Stock,
  TransferMovementRequest,
  UpdateBranchRequest,
  UpdateCategoryRequest,
  UpdateProductRequest,
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

const STOCK_CACHE_TTL_MS = 10_000;
const stockCacheByBranch = new Map<
  string,
  { cachedAt: number; rows: Stock[] }
>();

function buildQuery(params: object) {
  const query = new URLSearchParams();

  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });

  const value = query.toString();
  return value ? `?${value}` : "";
}

function normalizeProductsPage(
  payload: ProductsListResponse,
  query: ProductsQuery
): NormalizedProductsPage {
  const defaultTake = Number(query.take ?? query.limit ?? 20);
  const skip = Number(query.skip ?? 0);
  const items = payload.items ?? [];

  if ("meta" in payload) {
    const page = payload.meta.page ?? Math.floor(skip / defaultTake) + 1;
    const take = payload.meta.limit ?? defaultTake;
    const computedSkip = (page - 1) * take;
    const hasMore = payload.meta.hasNextPage;

    return {
      items,
      total: payload.meta.total,
      skip: computedSkip,
      take,
      nextSkip: hasMore ? computedSkip + take : null,
      hasMore,
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

async function getCachedStocksForBranch(branchId: string) {
  const cached = stockCacheByBranch.get(branchId);
  const now = Date.now();
  if (cached && now - cached.cachedAt < STOCK_CACHE_TTL_MS) {
    return cached.rows;
  }

  const rows = await apiClientFetch.get<Stock[]>("/stocks");
  stockCacheByBranch.set(branchId, { cachedAt: now, rows });
  return rows;
}

export const backendApi = {
  auth: {
    login: (body: LoginRequest) =>
      apiClientFetch.post<AuthResponse>("/auth/login", body, { branchScoped: false }),
    switchBranch: (body: SwitchBranchRequest) =>
      apiClientFetch.post<SessionResponse>("/auth/switch-branch", body, {
        branchScoped: false,
      }),
    refresh: (body?: RefreshRequest) =>
      apiClientFetch.post<AuthResponse>("/auth/refresh", body ?? {}, { branchScoped: false }),
    logout: (body?: LogoutRequest) =>
      apiClientFetch.post<LogoutResponse>("/auth/logout", body ?? {}, { branchScoped: false }),
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
      apiClientFetch.patch<User>(`/users/${id}/branches`, body, { branchScoped: false }),
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
    list: () => apiClientFetch.get<Branch[]>("/branches", { branchScoped: false }),
    getById: (id: string) =>
      apiClientFetch.get<Branch>(`/branches/${id}`, { branchScoped: false }),
    create: (body: CreateBranchRequest) =>
      apiClientFetch.post<Branch>("/branches", body, { branchScoped: false }),
    update: (id: string, body: UpdateBranchRequest) =>
      apiClientFetch.patch<Branch>(`/branches/${id}`, body, { branchScoped: false }),
    remove: (id: string) =>
      apiClientFetch.delete<boolean>(`/branches/${id}`, { branchScoped: false }),
    bootstrap: (body: CreateBranchRequest) =>
      apiClientFetch.post<BootstrapBranchResponse>("/branches/bootstrap", body, {
        branchScoped: false,
      }),
  },
  categories: {
    list: () => apiClientFetch.get<Category[]>("/categories", { branchScoped: false }),
    create: (body: CreateCategoryRequest) =>
      apiClientFetch.post<Category>("/categories", body, { branchScoped: false }),
    update: (id: string, body: UpdateCategoryRequest) =>
      apiClientFetch.patch<UpdateResult>(`/categories/${id}`, body, {
        branchScoped: false,
      }),
    remove: (id: string) =>
      apiClientFetch.delete<DeleteResult>(`/categories/${id}`, { branchScoped: false }),
  },
  products: {
    create: (body: CreateProductRequest) => apiClientFetch.post<Product>("/products", body),
    getByBarcode: (code: string) =>
      apiClientFetch.get<ProductListItem>(`/products/barcode/${code}`),
    list: (query: ProductsQuery = {}) =>
      apiClientFetch.get<ProductsListResponse>(`/products${buildQuery(query)}`),
    getById: (id: string) => apiClientFetch.get<ProductListItem>(`/products/${id}`),
    update: (id: string, body: UpdateProductRequest) =>
      apiClientFetch.patch<Product | null>(`/products/${id}`, body),
    remove: (id: string) => apiClientFetch.delete<boolean>(`/products/${id}`),
    uploadImageByProductId: (id: string, formData: FormData) =>
      apiClientFetch.post<UploadImageResponse>(`/products/${id}/image`, formData),
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
    list: () => apiClientFetch.get<Stock[]>("/stocks"),
    listByBranch: (branchId: string) =>
      apiClientFetch.get<Stock[]>(`/stocks/branch/${branchId}`),
    getByBranchAndProduct: (branchId: string, productId: string) =>
      apiClientFetch.get<Stock>(`/stocks/branch/${branchId}/product/${productId}`),
  },
  stockMovements: {
    list: () => apiClientFetch.get<Movement[]>("/stock-movements"),
    history: (productId?: string) =>
      apiClientFetch.get<Movement[]>(
        `/stock-movements/history${buildQuery({ productId })}`
      ),
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
    list: () => apiClientFetch.get<Sale[]>("/sales"),
    getById: (id: string) => apiClientFetch.get<Sale>(`/sales/${id}`),
  },
  snapshots: {
    metrics: (period: "monthly" | "quarterly" | "semiannual" | "annual" = "monthly") =>
      apiClientFetch.get<SnapshotMetricsResponse>(
        `/snapshots/metrics${buildQuery({ period })}`,
        { branchScoped: true }
      ),
  },
  expenses: {
    create: (body: CreateExpenseRequest) => {
      const payload: CreateExpenseRequest = {
        ...body,
        branchId: body.branchId ?? requireActiveBranchId(),
      };
      return apiClientFetch.post<Expense>("/expenses", payload);
    },
    list: (category?: string) =>
      apiClientFetch.get<Expense[]>(`/expenses${buildQuery({ category })}`),
    getById: (id: string) => apiClientFetch.get<Expense>(`/expenses/${id}`),
    remove: (id: string) => apiClientFetch.delete<true>(`/expenses/${id}`),
  },
  cash: {
    openSession: (body: OpenCashSessionRequest) =>
      apiClientFetch.post<CashSession>("/cash/sessions/open", body),
    addMovement: (sessionId: string, body: CreateCashMovementRequest) =>
      apiClientFetch.post<CashSession>(`/cash/sessions/${sessionId}/movements`, body),
    closeSession: (sessionId: string, body: CloseCashSessionRequest) =>
      apiClientFetch.post<CashSession>(`/cash/sessions/${sessionId}/close`, body),
    getCurrentSession: () =>
      apiClientFetch.get<CashSession | null>("/cash/sessions/current"),
    listSessions: (from?: string, to?: string) =>
      apiClientFetch.get<CashSession[]>(`/cash/sessions${buildQuery({ from, to })}`),
  },
  analytics: {
    sales: (query: AnalyticsSalesQuery) =>
      apiClientFetch.get<AnalyticsSalesResponse>(
        `/analytics/sales${buildQuery(query)}`
      ),
  },
  audit: {
    list: () => apiClientFetch.get<AuditLog[]>("/audit", { branchScoped: false }),
    byEntity: (entityType: string, entityId?: string) =>
      apiClientFetch.get<AuditLog[]>(
        `/audit/entity/${entityType}${buildQuery({ entityId })}`,
        { branchScoped: false }
      ),
    byUser: (userId: string) =>
      apiClientFetch.get<AuditLog[]>(`/audit/user/${userId}`, {
        branchScoped: false,
      }),
  },
  productsWithStock: async (
    query: ProductsQuery = {},
    branchIdOverride?: string | null
  ) => {
    const normalizedQuery: ProductsQuery = {
      ...query,
      name: query.name ?? query.search ?? query.q,
      q: query.q ?? query.search ?? query.name,
      search: query.search ?? query.q ?? query.name,
    };

    const explicitBranchId = branchIdOverride ?? null;
    const productsPayload = await apiClientFetch.get<ProductsListResponse>(
      `/products${buildQuery(normalizedQuery)}`,
      explicitBranchId
        ? {
            headers: {
              "x-branch-id": explicitBranchId,
            },
          }
        : undefined
    );
    const normalizedPage = normalizeProductsPage(productsPayload, normalizedQuery);
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
    const product = await apiClientFetch.get<ProductListItem>(
      `/products/barcode/${code}`
    );
    const { branchId } = getApiSession();
    if (!branchId) return product;

    const stock = await apiClientFetch.get<Stock>(
      `/stocks/branch/${branchId}/product/${product.id}`
    );

    return {
      ...product,
      stock: Number(stock.quantity ?? 0),
    } as ProductListItem;
  },
};
