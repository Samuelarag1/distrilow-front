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
export type SaleMode = "FIXED_CONSUMPTION" | "VARIABLE_QUANTITY";

export interface InventoryItem {
  id: string;
  name: string;
  stockBaseQuantity: number;
  branchId?: string | null;
}

export type ExpenseCategoryKnown =
  | "RENT"|"SERVICES"
  | "SALARIES"
  | "MARKETING"
  | "LUZ"
  | "DESCARTABLES"
  | "LIMPIEZA"
  | "DESINFECCION"
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
export type SalePaymentType = "CASH" | "TRANSFER" | "MIXED" | "OTHER";
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
  totalPages?: number;
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
  categoryName?: string | null;
  branchId?: string | null;
  brand?: string | null;
  trackStock?: boolean;
  stockBaseProductId?: string | null;
  stockConsumptionQuantity?: number | null;
  stockBaseUnit?: MeasurementType | null;
  allowNegativeStock?: boolean;
  imageUrl?: string | null;
  measurementType: MeasurementType;
  linkedProductId?: string | null;
  stock?: number;
  inventoryItemId?: string | null;
  saleMode?: SaleMode;
  consumptionPerSale?: number;
  inventoryStockBaseQuantity?: number;
  inventoryItem?: InventoryItem | null;
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
  stockBaseProductId?: string;
  stockConsumptionQuantity?: number;
  stockBaseUnit?: MeasurementType;
  allowNegativeStock?: boolean;
  imageUrl?: string;
  measurementType: MeasurementType;
  linkedProductId?: string;
  inventoryItemId?: string;
  saleMode?: SaleMode;
  consumptionPerSale?: number;
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
  skip?: number;
  take?: number;
  offset?: number;
  limit?: number;
  productId?: string;
  from?: string;
  to?: string;
}

export interface BarcodeLookupResolved {
  code?: string;
  barcodeType?: "STANDARD" | "INTERNAL_EAN13";
  rawBarcode?: string;
  barcodeBase?: string;
  pluCode?: string | null;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  priceType?: PriceType;
  pricingSource?: PricingMode;
  product: ProductListItem;
  stock?: {
    branchId: string;
    quantity: number;
    averageCost: number;
    lastPurchaseCost: number;
    updatedAt: string | null;
  };
}

export type BarcodeLookupResponse = ProductListItem | BarcodeLookupResolved;

export interface Stock {
  id: string;
  branchId: string;
  productId: string;
  stockProductId?: string | null;
  quantity: number;
  baseQuantity?: number | null;
  stockConsumptionQuantity?: number | null;
  stockBaseUnit?: MeasurementType | null;
  sharedStock?: StockSharedRelation | null;
  averageCost: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockSharedProduct {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  pluCode?: string | null;
  stockConsumptionQuantity?: number | null;
  stockBaseUnit?: MeasurementType | null;
  isBase?: boolean;
}

export interface StockSharedRelation {
  stockProductId?: string | null;
  isShared: boolean;
  linkedProductsCount: number;
  linkedProducts: StockSharedProduct[];
}

export interface StockListItem extends Stock {
  name?: string | null;
  product?: Partial<ProductListItem> | null;
  sharedStock?: StockSharedRelation | null;
}

export interface StockDetail extends StockListItem {
  stockProductId?: string | null;
  quantity: number;
  baseQuantity?: number | null;
  stockConsumptionQuantity?: number | null;
  stockBaseUnit?: MeasurementType | null;
  sharedStock?: StockSharedRelation | null;
}

export interface CreateStockRequest {
  branchId?: string;
  productId: string;
  quantity: number;
  averageCost: number;
}

export interface StockQuery {
  page?: number;
  skip?: number;
  take?: number;
  offset?: number;
  limit?: number;
  search?: string;
  name?: string;
  q?: string;
  productId?: string;
  categoryId?: string;
  stockStatus?: string;
  lowStockThreshold?: number;
}

export type StockLotStatus = "expired" | "today" | "upcoming" | (string & {});

export interface StockLotProductSnapshot {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  pluCode?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
}

export interface StockLot {
  id: string;
  branchId: string;
  productId: string;
  lotCode: string;
  expiresAt: string;
  quantity: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  daysUntilExpiry?: number | null;
  status?: StockLotStatus | null;
  product?: StockLotProductSnapshot | null;
}

export interface StockLotsListQuery {
  search?: string;
  productId?: string;
  categoryId?: string;
  days?: number;
  includeExpired?: boolean;
  onlyPositive?: boolean;
  page?: number;
  limit?: number;
}

export interface StockLotsListResponse {
  items: StockLot[];
  filters?: Partial<StockLotsListQuery>;
  meta: OffsetPaginationMeta;
}

export interface UpsertStockLotRequest {
  productId: string;
  lotCode: string;
  expiresAt: string;
  quantity: number;
  notes?: string;
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
  [key: string]: unknown;
}

export interface StockSummaryCategoryItem {
  categoryId?: string | null;
  categoryName?: string | null;
  productsTotal?: number;
  lowStockTotal?: number;
  stockUnitsTotal?: number;
  inventoryValueCost?: number;
  inventoryValueRetail?: number;
  inventoryValueWholesale?: number;
}

export interface StockSummaryCategoriesResponse {
  items: StockSummaryCategoryItem[];
  total: number;
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
  linkedProductId?: string;
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
  receivedAmount?: number | null;
  changeAmount?: number | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalePaymentBreakdown {
  paidByMethod?: Record<string, number | null | undefined> | null;
  byMethod?: Record<string, number | null | undefined> | null;
  appliedByMethod?: Record<string, number | null | undefined> | null;
  [key: string]:
    | number
    | Record<string, number | null | undefined>
    | null
    | undefined;
}

export interface SalePaymentBreakdownByMethod {
  cash?: number | null;
  transfer?: number | null;
  card?: number | null;
  other?: number | null;
}

export interface CreateSaleRequest {
  branchId?: string;
  clientId?: string;
  items: SaleItemInput[];
  payments?: SalePaymentInput[];
  notes?: string;
}

export interface SaleSummary {
  id: string;
  branchId: string;
  userId?: string | null;
  userName?: string | null;
  clientId?: string | null;
  total?: number;
  totalAmount?: number;
  totalCost?: number;
  profit?: number;
  paidAmount?: number;
  outstandingAmount?: number;
  paymentStatus?: SaleChargeStatus;
  chargeStatus?: SaleChargeStatus;
  lifecycleStatus?: SaleLifecycleStatus;
  status?: string;
  cancelledAt?: string | null;
  deletedAt?: string | null;
  itemsCount?: number;
  itemsQuantity?: number;
  paymentBreakdown?: SalePaymentBreakdown;
  paymentBreakdownByMethod?: SalePaymentBreakdownByMethod | null;
  paymentType?: SalePaymentType | null;
  pendingReason?: string | null;
  note?: string | null;
  notes?: string | null;
  notesRaw?: string | null;
  originalNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaleDetail extends SaleSummary {
  items: Array<{
    id?: string;
    productId: string;
    productName?: string;
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
    linkedProductId?: string;
  }>;
  payments?: SalePayment[];
}

export type Sale = SaleSummary | SaleDetail;

export interface SaleListQuery {
  // skip?: number;
  // take?: number;
  page?: number;
  offset?: number;
  limit?: number;
  search?: string;
  status?: string;
  paymentType?: SalePaymentType;
  paymentStatus?: SaleChargeStatus;
  chargeStatus?: SaleChargeStatus;
  lifecycleStatus?: SaleLifecycleStatus;
  from?: string;
  to?: string;
  sort?:
    | "createdAt:desc"
    | "createdAt:asc"
    | "totalAmount:desc"
    | "totalAmount:asc";
}

export interface SalePaymentsListQuery {
  skip?: number;
  take?: number;
  offset?: number;
  page?: number;
  limit?: number;
  saleId?: string;
  method?: PaymentMethod;
  from?: string;
  to?: string;
}

export interface SnapshotMetricsResponse {
  period?: SnapshotPeriod;
  scope?: "active" | "all";
  range?: {
    from?: string;
    to?: string;
  };
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
  growthTrend?: number;
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
    growthTrend?: number;
  };
  history?: Array<{
    period?: string;
    totalIncome?: number;
    operationalExpenses?: number;
    totalCostOfGoods?: number;
    netProfit?: number;
  }>;
  [key: string]: unknown;
}

export interface CreateExpenseRequest {
  branchId?: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  context?: ExpenseContext;
  date?: string;
}

export interface Expense {
  id: string;
  branchId: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  context?: ExpenseContext;
  date?: string;
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
  openedByUserId?: string | null;
  openedAt?: string;
  openingFloat: number;
  closedByUserId?: string | null;
  closedAt?: string | null;
  expectedCash?: number;
  countedCash?: number;
  difference?: number;
  notes?: string | null;
  salesCount?: number;
  paymentsCount?: number;
  lastActivityAt?: string | null;
  movements?: CashMovement[];
  totals?: {
    cashPayments?: number;
    transferPayments?: number;
    movementIn?: number;
    movementOut?: number;
    [key: string]: number | undefined;
  };
}

export interface CashCurrentSummaryResponse {
  hasOpenSession: boolean;
  session: CashSession | null;
  branchId?: string | null;
  updatedAt?: string | null;
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
  sourceType: string;
  direction: "IN" | "OUT" | "INFO" | (string & {});
  amount: number;
  method?: string | null;
  receivedAmount?: number | null;
  changeAmount?: number | null;
  netAmount?: number | null;
  notes?: string | null;
  reference?: string | null;
  type?: string;
  description?: string | null;
  saleId?: string | null;
  sessionId?: string | null;
  createdAt?: string;
}

export interface CashBookDailyQuery {
  page?: number;
  limit?: number;
  offset?: number;
  skip?: number;
  take?: number;
  date?: string;
}

export interface CashBookDailyResponse {
  date: string;
  branchId: string;
  summary: CashBookDailySummary;
  sessions: CashSession[];
  entries: CashBookEntry[];
  meta: OffsetPaginationMeta;
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

export interface ReportingSalesSummaryBucket {
  revenue: number;
  orders: number;
  avgTicket: number;
  revenueGrowthPct?: number;
  ordersGrowthPct?: number;
  avgTicketGrowthPct?: number;
  cashIncome?: number;
  transferIncome?: number;
}

export interface ReportingSalesSummaryResponse {
  timezone?: string;
  today: ReportingSalesSummaryBucket;
  yesterday?: ReportingSalesSummaryBucket;
  rollingMonth: ReportingSalesSummaryBucket;
  previousRollingMonth?: ReportingSalesSummaryBucket;
}

export interface ReportingGlobalMetricsByPaymentMethod {
  cashTotal?: number | null;
  transferTotal?: number | null;
  appliedTotal?: number | null;
  receivedCashTotal?: number | null;
  receivedTransferTotal?: number | null;
  receivedTotal?: number | null;
}

export interface ReportingGlobalMetricsResponse {
  range?: {
    from?: string;
    to?: string;
  };
  sales?: {
    byPaymentMethod?: ReportingGlobalMetricsByPaymentMethod | null;
  } | null;
}

export interface ReportsTopProductsQuery {
  branchId?: string;
  from: string;
  to: string;
  offset?: number;
  skip?: number;
  page?: number;
  limit?: number;
  search?: string;
  q?: string;
  categoryId?: string;
}

export interface ReportsSalesOverviewQuery {
  branchId?: string;
  from: string;
  to: string;
  topProductsLimit?: number;
}

export interface ReportsSoldQuantitySummary {
  unitsTotal: number;
  kilosTotal: number;
}

export interface ReportsTopProductItem {
  productId: string;
  productName: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  measurementType?: MeasurementType | null;
  isWeighable?: boolean;
  soldQuantity?: ReportsSoldQuantitySummary;
  unitsTotal: number;
  revenueTotal: number;
  unitsRetail: number;
  revenueRetail: number;
  costRetail?: number;
  profitRetail?: number;
  marginRetailPct?: number;
  unitsWholesale: number;
  revenueWholesale: number;
  costWholesale?: number;
  profitWholesale?: number;
  marginWholesalePct?: number;
  costTotal: number;
  profitTotal?: number;
  marginTotal?: number;
  marginTotalPct?: number;
  marginPct?: number;
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
  total?: number;
  hasMore?: boolean;
  meta?: OffsetPaginationMeta;
}

export interface ReportsProductMarginsTableQuery {
  branchId?: string;
  startDate: string;
  endDate: string;
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
}

export interface ReportsProductMarginsMetrics {
  quantitySold: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossMarginPercent: number;
}

export interface ReportsProductMarginsTableItem {
  productId: string;
  productName: string;
  categoryId?: string | null;
  categoryName?: string | null;
  retail: ReportsProductMarginsMetrics;
  wholesale: ReportsProductMarginsMetrics;
  override: ReportsProductMarginsMetrics;
  total: ReportsProductMarginsMetrics;
}

export interface ReportsProductMarginsTableResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  filters: {
    branchId?: string | null;
    categoryId?: string | null;
    search?: string | null;
  };
  total: number;
  page: number;
  limit: number;
  items: ReportsProductMarginsTableItem[];
}

export interface ReportsSalesPriceTypesSummaryQuery {
  branchId?: string;
  from: string;
  to: string;
  categoryId?: string;
}

export interface ReportsSalesPriceTypesSummaryItem {
  key: PriceType | string;
  priceType?: PriceType | string;
  label?: string | null;
  quantity?: number;
  unitsTotal: number;
  revenue?: number;
  revenueTotal: number;
  costTotal?: number;
  cost?: number;
  profitTotal?: number;
  profit?: number;
  marginPercent?: number;
  itemCount?: number;
  saleCount?: number;
  salesCount?: number;
}

export interface ReportsSalesPriceTypesSummaryResponse {
  range: {
    from: string;
    to: string;
  };
  filters: {
    branchId?: string | null;
    categoryId?: string | null;
  };
  items: ReportsSalesPriceTypesSummaryItem[];
  totals?: {
    unitsTotal: number;
    revenueTotal: number;
    costTotal: number;
    profitTotal: number;
    marginPercent: number;
    itemCount: number;
    saleCount: number;
  };
}

export interface ReportsSalesPricingSourcesSummaryQuery {
  branchId?: string;
  from: string;
  to: string;
  categoryId?: string;
}

export interface ReportsSalesPricingSourcesSummaryItem {
  key: PricingMode | string;
  pricingSource?: PricingMode | string;
  label?: string | null;
  quantity?: number;
  unitsTotal: number;
  revenue?: number;
  revenueTotal: number;
  cost?: number;
  profit?: number;
  marginPercent?: number;
  itemCount?: number;
  saleCount?: number;
  salesCount?: number;
}

export interface ReportsSalesPricingSourcesSummaryResponse {
  range: {
    from: string;
    to: string;
  };
  filters: {
    branchId?: string | null;
    categoryId?: string | null;
  };
  items: ReportsSalesPricingSourcesSummaryItem[];
}

export interface ReportsSalesOverviewResponse {
  range: {
    from: string;
    to: string;
    timezone?: string;
  };
  totals: {
    revenueTotal: number;
    costTotal: number;
    grossMarginTotal: number;
    grossMarginPercent: number;
    salesTotal: number;
    saleItemsTotal: number;
    distinctProductsSold: number;
    weightedKgTotal: number;
    unitItemsTotal: number;
    byPriceType?: Record<string, unknown>;
    byPaymentMethod?: Record<string, unknown>;
  };
  payments: {
    cashTotal: number;
    transferTotal: number;
    appliedTotal: number;
    receivedCashTotal: number;
    receivedTransferTotal: number;
    receivedTotal: number;
  };
  soldQuantity: ReportsSoldQuantitySummary;
  dailyRevenue: {
    points: Array<{
      period: string;
      value: number;
    }>;
    totals: {
      value: number;
    };
  };
  priceTypes: ReportsSalesPriceTypesSummaryResponse;
  pricingSources: ReportsSalesPricingSourcesSummaryResponse & {
    totals?: {
      unitsTotal: number;
      revenueTotal: number;
      costTotal: number;
      profitTotal: number;
      marginPercent: number;
      itemCount: number;
      saleCount: number;
    };
  };
  topProducts: ReportsTopProductsResponse;
  warnings: unknown[];
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

export type InventoryOverviewStockStatus =
  | "OUT_OF_STOCK"
  | "LOW"
  | "NORMAL"
  | "HIGH";

export interface ReportsInventoryOverviewQuery {
  branchId?: string;
  categoryId?: string;
  search?: string;
  stockStatus?: InventoryOverviewStockStatus;
  page?: number;
  limit?: number;
  offset?: number;
  skip?: number;
  take?: number;
}

export interface ReportsInventoryOverviewItem {
  productId: string;
  productName: string;
  branchId?: string | null;
  sourceBranchId?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  measurementType?: MeasurementType | null;
  trackStock?: boolean | null;
  stock?: number | null;
  baseQuantity?: number | null;
  stockProductId?: string | null;
  stockConsumptionQuantity?: number | null;
  stockBaseUnit?: MeasurementType | null;
  minStock?: number | null;
  maxStock?: number | null;
  shortageQty?: number | null;
  stockStatus?: InventoryOverviewStockStatus | null;
  sharedStock?: StockSharedRelation | null;
  averageCost?: number | null;
  retailPrice?: number | null;
  wholesalePrice?: number | null;
  updatedAt?: string | null;
}

export interface ReportsInventoryOverviewResponse {
  items: ReportsInventoryOverviewItem[];
  total?: number;
  page?: number;
  limit?: number;
  meta?: OffsetPaginationMeta;
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

export type CashOverviewGroupBy = "day" | "month" | "session";

export interface ReportsCashOverviewQuery {
  branchId?: string;
  from: string;
  to: string;
  groupBy: CashOverviewGroupBy;
}

export interface ReportsCashOverviewSource {
  unclassifiedOutflow?: number | null;
  outflowClassificationStatus?: string | null;
  [key: string]: unknown;
}

export interface ReportsCashOverviewItem {
  id?: string | null;
  key?: string | null;
  label?: string | null;
  period?: string | null;
  date?: string | null;
  month?: string | null;
  sessionId?: string | null;
  cashSales?: number | null;
  transferSales?: number | null;
  salesTotal?: number | null;
  manualIncome?: number | null;
  cashPurchases?: number | null;
  withdrawalsGross?: number | null;
  withdrawalsNet?: number | null;
  netTotal?: number | null;
  countedCash?: number | null;
  expectedCash?: number | null;
  difference?: number | null;
  source?: ReportsCashOverviewSource | null;
}

export interface ReportsCashOverviewResponse {
  range?: {
    from?: string;
    to?: string;
  };
  filters?: {
    branchId?: string | null;
  };
  groupBy?: CashOverviewGroupBy;
  items: ReportsCashOverviewItem[];
  totals?: ReportsCashOverviewItem | null;
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
