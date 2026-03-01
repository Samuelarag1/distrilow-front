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
export type ExpenseCategory =
  | "RENT"
  | "SERVICES"
  | "SALARIES"
  | "SUPPLIES"
  | "MARKETING"
  | "MAINTENANCE"
  | "TAXES"
  | "OTHER";
export type CashMovementType = "IN" | "OUT";
export type AnalyticsGroupBy = "day" | "month" | "quarter" | "year";
export type AnalyticsMetric = "revenue" | "count" | "avgTicket" | "profit";
export type SnapshotPeriod = "monthly" | "quarterly" | "semiannual" | "annual";

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

export interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  costPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  marginPercent?: number | null;
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

export type UpdateProductRequest = Partial<CreateProductRequest>;

export interface OffsetPaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CursorPageInfo {
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export type ProductsListResponse =
  | {
      items: ProductListItem[];
      pageInfo: CursorPageInfo;
    }
  | {
      items: ProductListItem[];
      meta: OffsetPaginationMeta;
    };

export interface ProductsQuery {
  page?: number;
  limit?: number;
  cursor?: string;
  skip?: number;
  take?: number;
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

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSaleRequest {
  branchId?: string;
  clientId?: string;
  items: SaleItemInput[];
}

export interface Sale {
  id: string;
  branchId: string;
  clientId?: string | null;
  total?: number;
  status?: string;
  createdAt?: string;
  items: Array<{
    id?: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal?: number;
  }>;
}

export interface SnapshotMetricsResponse {
  totalRevenue?: number;
  totalOrders?: number;
  activeCustomers?: number;
  lowStockItems?: number;
  dailyCashbox?: number;
  walkInCustomers?: number;
  pendingBulkOrders?: number;
  creditUtilized?: number;
  [key: string]: unknown;
}

export interface CreateExpenseRequest {
  branchId?: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
}

export interface Expense {
  id: string;
  branchId: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  createdAt?: string;
  updatedAt?: string;
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
