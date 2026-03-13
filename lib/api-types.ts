export type UserRole =
  | "admin"
  | "manager"
  | "staff"
  | "seller"
  | "cashier"
  | "viewer";

export type BranchType = "STORE" | "WAREHOUSE";
export type MeasurementType = "unit" | "gram" | "kg" | "ml" | "liter";
export type MovementType =
  | "PURCHASE"
  | "SALE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT"
  | "RETURN"
  | "LOSS"
  | "EXPIRED";
export type ExpenseCategoryKnown =
  | "RENT"
  | "SERVICES"
  | "SALARIES"
  | "SUPPLIES"
  | "MARKETING"
  | "MAINTENANCE"
  | "TAXES"
  | "LUZ"
  | "DESCARTABLES"
  | "LIMPIEZA"
  | "BOLSAS"
  | "DESINFECCION"
  | "NAFTA"
  | "MONOTRIBUTO"
  | "VEHICULO_PARTICULAR"
  | "OTHER";
export type ExpenseCategory = ExpenseCategoryKnown;
export type ExpenseContext = "GENERAL" | "RETAIL" | "WHOLESALE";
export type CashMovementType = "IN" | "OUT";
export type AnalyticsGroupBy = "day" | "month" | "quarter" | "year";
export type AnalyticsMetric = "revenue" | "count" | "avgTicket" | "profit";
export type SnapshotPeriod = "monthly" | "quarterly" | "semiannual" | "annual";
export type SaleChargeStatus = "PENDING" | "PARTIALLY_PAID" | "PAID";
export type SaleLifecycleStatus = "ACTIVE" | "CANCELLED";
export type PricingMode = "AUTO" | "MANUAL";
export type PriceType = "RETAIL" | "WHOLESALE";
export type PaymentMethod =
  | "CASH"
  | "TRANSFER"
  | "DEBIT_CARD"
  | "CREDIT_CARD"
  | "MERCADO_PAGO"
  | "OTHER"
  | (string & {});

export interface SessionBranch {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface SessionInfo {
  activeBranchId: string | null;
  availableBranches: SessionBranch[];
  needsOnboarding: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  session: SessionInfo;
}

export interface SessionResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: AuthUser;
  session: SessionInfo;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken?: string;
}

export interface SwitchBranchRequest {
  branchId: string;
}

export interface LogoutRequest {
  refreshToken?: string;
}

export interface LogoutResponse {
  success: true;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  defaultBranchId?: string | null;
  branches?: SessionBranch[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  isActive?: boolean;
}

export type UpdateUserRequest = Partial<CreateUserRequest>;

export interface UpdateUserBranchesRequest {
  branchIds: string[];
  defaultBranchId?: string;
  replace?: boolean;
}

export interface Branch {
  id: string;
  code: string;
  address: string;
  name: string;
  branchType: BranchType;
  isActive: boolean;
  phone?: string | null;
  email?: string | null;
  allowsSales?: boolean;
  allowsPurchases?: boolean;
  allowsTransfers?: boolean;
  managesOwnStock?: boolean;
  allowNegativeStock?: boolean;
  isMain?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBranchRequest {
  code: string;
  address: string;
  name: string;
  branchType: BranchType;
  isActive?: boolean;
  phone?: string;
  email?: string;
}

export interface UpdateBranchRequest {
  name?: string;
  address?: string;
  branchType?: BranchType;
  isMain?: boolean;
  allowsSales?: boolean;
  allowsPurchases?: boolean;
  allowsTransfers?: boolean;
  managesOwnStock?: boolean;
  allowNegativeStock?: boolean;
  isActive?: boolean;
  phone?: string;
  email?: string;
  code?: string;
}

export interface BootstrapBranchResponse {
  branch: Branch;
  session: SessionInfo;
}

export interface Category {
  id: string;
  name: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface UpdateCategoryRequest {
  name?: string;
}

export interface UpdateResult {
  affected?: number;
}

export interface DeleteResult {
  affected?: number;
}

export interface OffsetPaginationMeta {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  page?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: OffsetPaginationMeta;
}

export interface CursorPageInfo {
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
  pluCode?: string | null;
  isWeighable?: boolean;
  wholesaleMinQuantity?: number | null;
  name: string;
  description?: string | null;
  costPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  marginPercent?: number | null;
  priceReviewPending?: boolean;
  costReviewPending?: boolean;
  isActive?: boolean;
  categoryId?: string | null;
  branchId?: string | null;
  brand?: string | null;
  trackStock?: boolean;
  allowNegativeStock?: boolean;
  imageUrl?: string | null;
  measurementType: MeasurementType;
  stock?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductListItem = Product;

export interface CreateProductRequest {
  sku: string;
  barcode?: string;
  pluCode?: string;
  isWeighable?: boolean;
  wholesaleMinQuantity?: number;
  name: string;
  description?: string;
  costPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  marginPercent?: number;
  isActive?: boolean;
  categoryId?: string;
  branchId?: string;
  brand?: string;
  trackStock?: boolean;
  allowNegativeStock?: boolean;
  imageUrl?: string;
  measurementType: MeasurementType;
}

export interface UpdateProductReviewFlagsRequest {
  priceReviewPending?: boolean;
  costReviewPending?: boolean;
}

export type UpdateProductRequest = Partial<CreateProductRequest>;

export type ProductsListResponse =
  | {
      items: ProductListItem[];
      pageInfo: CursorPageInfo;
    }
  | PaginatedResponse<ProductListItem>;

export interface ProductsQuery {
  skip?: number;
  take?: number;
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
  name?: string;
  q?: string;
  search?: string;
  categoryId?: string;
  sortBy?: "createdAt" | "name" | "sku" | "price";
  sortOrder?: "asc" | "desc";
}

export interface UploadImageResponse {
  imageUrl: string;
  path: string;
  product: Product;
}

export interface ProductReviewPendingQuery {
  skip?: number;
  take?: number;
  offset?: number;
  limit?: number;
  search?: string;
}

export interface ProductPriceCostHistoryRow {
  id: string;
  productId: string;
  name?: string | null;
  changedByUserId?: string | null;
  oldCostPrice?: number | null;
  newCostPrice?: number | null;
  oldRetailPrice?: number | null;
  newRetailPrice?: number | null;
  oldWholesalePrice?: number | null;
  newWholesalePrice?: number | null;
  reason?: string | null;
  createdAt?: string;
  product?: ProductListItem;
}

export interface ProductPriceCostHistoryQuery {
  // skip?: number;
  // take?: number;
  offset?: number;
  limit?: number;
  productId?: string;
  from?: string;
  to?: string;
}

export interface BarcodeLookupResolved {
  code?: string;
  barcodeType?: "STANDARD" | "INTERNAL_EAN13" | "UNKNOWN";
  rawBarcode?: string;
  barcodeBase?: string;
  pluCode?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  priceType?: PriceType;
  pricingSource?: PricingMode;
  product: ProductListItem;
}

export type BarcodeLookupResponse = ProductListItem | BarcodeLookupResolved;

export interface Stock {
  id: string;
  branchId: string;
  productId: string;
  quantity: number;
  averageCost: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStockRequest {
  branchId?: string;
  productId: string;
  quantity: number;
  averageCost: number;
}

export interface StockQuery {
  skip?: number;
  take?: number;
  offset?: number;
  limit?: number;
  productId?: string;
  stockStatus?: string;
  lowStockThreshold?: number;
}

export interface StockSummaryResponse {
  products: {
    total: number;
    lowStock: number;
  };
  inventoryValue: {
    cost: number;
    retail: number;
    wholesale: number;
  };
  quantity: {
    total: number;
  };
  categories: {
    total: number;
    withProducts: number;
    withStock: number;
  };
  [key: string]: unknown;
}

export interface Movement {
  id: string;
  branchId: string;
  productId: string;
  type: MovementType;
  quantity: number;
  unitCost?: number | null;
  reason?: string | null;
  createdAt?: string;
}

export interface CreateMovementRequest {
  branchId?: string;
  productId: string;
  type: MovementType;
  quantity: number;
  unitCost?: number;
  reason?: string;
}

export interface TransferMovementRequest {
  productId: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
}

export interface MovementQuery {
  skip?: number;
  take?: number;
  offset?: number;
  limit?: number;
  productId?: string;
  type?: MovementType;
  from?: string;
  to?: string;
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
  pricingMode?: PricingMode;
  requestedPriceType?: PriceType;
  manualOverrideReason?: string;
}

export interface SalePaymentInput {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  paidAt?: string;
}

export interface SalePayment extends SalePaymentInput {
  id: string;
  saleId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSaleRequest {
  branchId?: string;
  clientId?: string;
  items: SaleItemInput[];
  payments?: SalePaymentInput[];
}

export interface Sale {
  id: string;
  branchId: string;
  clientId?: string | null;
  total?: number;
  totalAmount?: number;
  paidAmount?: number;
  outstandingAmount?: number;
  chargeStatus?: SaleChargeStatus;
  lifecycleStatus?: SaleLifecycleStatus;
  status?: string;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items: Array<{
    id?: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal?: number;
    pricingMode?: PricingMode;
    requestedPriceType?: PriceType;
    priceType?: PriceType;
    pricingSource?: PricingMode;
    baseRetailPrice?: number;
    baseWholesalePrice?: number;
    pricingRuleSnapshot?: unknown;
    manualOverrideReason?: string | null;
  }>;
  payments?: SalePayment[];
}

export interface SaleListQuery {
  // skip?: number;
  // take?: number;
  offset?: number;
  limit?: number;
  search?: string;
  chargeStatus?: SaleChargeStatus;
  from?: string;
  to?: string;
}

export interface SalePaymentsListQuery {
  skip?: number;
  take?: number;
  offset?: number;
  limit?: number;
  saleId?: string;
  method?: PaymentMethod;
  from?: string;
  to?: string;
}

export interface SnapshotMetricsResponse {
  totalRevenue?: number;
  totalIncome?: number;
  totalOrders?: number;
  totalSales?: number;
  activeCustomers?: number;
  uniqueClients?: number;
  lowStockItems?: number;
  lowStockProducts?: number;
  dailyCashbox?: number;
  dailyCash?: number;
  walkInCustomers?: number;
  pendingBulkOrders?: number;
  creditUtilized?: number;
  operationalExpenses?: number;
  totalCostOfGoods?: number;
  netProfit?: number;
  averageTicket?: number;
  growthTrend?: string;
  retentionRate?: string;
  summary?: {
    totalIncome?: number;
    operationalExpenses?: number;
    totalCostOfGoods?: number;
    netProfit?: number;
    dailyCash?: number;
    dailyCashBreakdown?: {
      openingFloat?: number;
      cashFromPayments?: number;
      movementIn?: number;
      movementOut?: number;
    };
  };
  inventory?: {
    lowStockProducts?: number;
  };
  salesAnalysis?: {
    totalSales?: number;
    uniqueClients?: number;
    averageTicket?: number;
    growthTrend?: string;
  };
  [key: string]: unknown;
}

export interface CreateExpenseRequest {
  branchId?: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  context?: ExpenseContext;
}

export interface Expense {
  id: string;
  branchId: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  context?: ExpenseContext;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseListQuery {
  skip?: number;
  take?: number;
  offset?: number;
  limit?: number;
  category?: string;
  context?: ExpenseContext;
  from?: string;
  to?: string;
  search?: string;
}

export interface ExpenseAnalyticsByCategory {
  category: string;
  total: number;
  sharePercent: number;
}

export interface ExpenseAnalyticsEvolutionPoint {
  period: string;
  total: number;
}

export interface ExpenseAnalyticsResponse {
  period: SnapshotPeriod;
  context: ExpenseContext | "ALL";
  total: number;
  byCategory: ExpenseAnalyticsByCategory[];
  evolution: ExpenseAnalyticsEvolutionPoint[];
  currency?: string;
}

export interface CashSession {
  id: string;
  branchId: string;
  status: "OPEN" | "CLOSED";
  openingFloat: number;
  expectedCash?: number;
  countedCash?: number;
  difference?: number;
  notes?: string;
  openedAt?: string;
  closedAt?: string | null;
  movements?: CashMovement[];
  totals?: Record<string, number>;
}

export interface CashMovement {
  id: string;
  sessionId: string;
  type: CashMovementType;
  reason: string;
  amount: number;
  createdAt?: string;
}

export interface OpenCashSessionRequest {
  openingFloat: number;
}

export interface CreateCashMovementRequest {
  type: CashMovementType;
  reason: string;
  amount: number;
}

export interface CloseCashSessionRequest {
  countedCash: number;
  notes?: string;
}

export interface CashBookDailySummary {
  openingFloat: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  differenceSource?: "RUNNING" | "CLOSED_SESSION" | string;
  movementBalance: number;
  income: {
    cashFromPayments: number;
    transferFromPayments: number;
    movementIn: number;
  };
  outflow: {
    movementOut: number;
  };
}

export interface CashBookEntry {
  id: string;
  type: string;
  amount: number;
  method?: string | null;
  description?: string | null;
  saleId?: string | null;
  sessionId?: string | null;
  createdAt?: string;
}

export interface CashBookDailyQuery {
  skip?: number;
  take?: number;
  date?: string;
  offset?: number;
  limit?: number;
}

export interface CashBookDailyResponse {
  date: string;
  summary: CashBookDailySummary;
  entries: PaginatedResponse<CashBookEntry>;
}

export interface AnalyticsPoint {
  period: string;
  value: number;
}

export interface AnalyticsSalesResponse {
  range: { from: string; to: string };
  groupBy: AnalyticsGroupBy;
  metric: AnalyticsMetric;
  currency: "ARS";
  points: AnalyticsPoint[];
  totals: { value: number };
}

export interface AnalyticsSalesQuery {
  from: string;
  to: string;
  groupBy: AnalyticsGroupBy;
  metric: AnalyticsMetric;
}

export interface ReportsTopProductsQuery {
  branchId?: string;
  from: string;
  to: string;
  limit?: number;
  categoryId?: string;
}

export interface ReportsTopProductItem {
  productId: string;
  productName: string;
  categoryId?: string | null;
  categoryName?: string | null;
  unitsTotal: number;
  revenueTotal: number;
  unitsRetail: number;
  revenueRetail: number;
  unitsWholesale: number;
  revenueWholesale: number;
  costTotal: number;
  marginTotal: number;
  marginPct: number;
}

export interface ReportsTopProductsResponse {
  range: {
    from: string;
    to: string;
  };
  filters: {
    branchId?: string | null;
    categoryId?: string | null;
  };
  limit: number;
  items: ReportsTopProductItem[];
}

export interface ReportsInventorySummaryQuery {
  branchId?: string;
  categoryId?: string;
  search?: string;
  lowStockThreshold?: number;
}

export interface ReportsInventoryCategorySummaryItem {
  categoryId?: string | null;
  categoryName?: string | null;
  productsTotal: number;
  lowStockTotal: number;
  inventoryValueCost: number;
  inventoryValueRetail: number;
  inventoryValueWholesale: number;
  stockUnitsTotal: number;
}

export interface ReportsInventorySummaryResponse {
  branchId?: string | null;
  lowStockThreshold: number;
  filters: {
    categoryId?: string | null;
    search?: string | null;
  };
  productsTotal: number;
  lowStockTotal: number;
  inventoryValueCost: number;
  inventoryValueRetail: number;
  inventoryValueWholesale: number;
  stockUnitsTotal: number;
  byCategory: ReportsInventoryCategorySummaryItem[];
}

export interface ReportsInventoryLowStockQuery {
  branchId?: string;
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  lowStockThreshold?: number;
}

export interface ReportsInventoryLowStockItem {
  productId: string;
  productName: string;
  stock: number;
  minStock: number;
  shortageQty: number;
  category?: {
    id?: string | null;
    name?: string | null;
  } | null;
  costPrice?: number | null;
  retailPrice?: number | null;
  wholesalePrice?: number | null;
}

export interface ReportsInventoryLowStockResponse {
  items: ReportsInventoryLowStockItem[];
  total: number;
  page: number;
  limit: number;
  summary: {
    productsTotal: number;
    lowStockTotal: number;
    inventoryValueCost: number;
    inventoryValueRetail: number;
    inventoryValueWholesale: number;
    stockUnitsTotal: number;
  };
}

export interface ReportsExpensesProjectionQuery {
  branchId?: string;
  from: string;
  to: string;
  horizonMonths?: 3 | 6;
  context?: ExpenseContext;
  category?: ExpenseCategory;
}

export interface ReportsExpensesProjectionResponse {
  range: {
    from: string;
    to: string;
  };
  filters: {
    branchId?: string | null;
    context?: ExpenseContext | null;
    category?: ExpenseCategory | null;
  };
  horizonMonths: 3 | 6;
  trendPct: number;
  historical: Array<{
    month: string;
    total: number;
  }>;
  projected: Array<{
    month: string;
    total: number;
  }>;
  byCategoryHistorical: Array<{
    category: ExpenseCategory | string;
    total: number;
    pct: number;
  }>;
  byCategoryProjected: Array<{
    category: ExpenseCategory | string;
    total: number;
    pct: number;
  }>;
}

export interface ReportsCashMonthlyQuery {
  branchId?: string;
  fromMonth: string;
  toMonth: string;
}

export interface ReportsCashMonthlyItem {
  month: string;
  openingFloatTotal: number;
  cashFromSales: number;
  transferFromSales: number;
  manualIn: number;
  manualOut: number;
  expectedCashClose: number;
  countedCashClose: number;
  difference: number;
  sessionsCount: number;
  daysWithClose: number;
  avgDifference: number;
}

export interface ReportsCashMonthlyResponse {
  range: {
    fromMonth: string;
    toMonth: string;
  };
  filters: {
    branchId?: string | null;
  };
  items: ReportsCashMonthlyItem[];
}

export interface AuditLog {
  id: string;
  userId: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  metadata?: unknown;
  createdAt: string;
  user?: {
    id: string;
    email?: string;
    role?: UserRole;
  };
}

export interface AuditQuery {
  skip?: number;
  take?: number;
  offset?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  userId?: string;
  from?: string;
  to?: string;
  search?: string;
}
