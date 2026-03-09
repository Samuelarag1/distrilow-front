export interface NormalizedSnapshotMetrics {
  totalRevenue: number;
  totalOrders: number;
  activeCustomers: number;
  lowStockItems: number;
  dailyCashbox?: number;
  walkInCustomers?: number;
  pendingBulkOrders?: number;
  creditUtilized?: number;
  operationalExpenses?: number;
  totalCostOfGoods?: number;
  netProfit?: number;
  averageTicket?: number;
  growthTrend?: string;
  retentionRate?: string;
}

type RecordLike = Record<string, unknown>;

function asRecord(value: unknown): RecordLike {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as RecordLike;
  }
  return {};
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeSnapshotMetrics(
  snapshot: unknown
): NormalizedSnapshotMetrics {
  const source = asRecord(snapshot);
  const summary = asRecord(source.summary);
  const inventory = asRecord(source.inventory);
  const salesAnalysis = asRecord(source.salesAnalysis);

  const normalized: NormalizedSnapshotMetrics = {
    totalRevenue: toNumber(
      source.totalRevenue ?? source.totalIncome ?? summary.totalIncome,
      0
    ),
    totalOrders: toNumber(
      source.totalOrders ?? source.totalSales ?? salesAnalysis.totalSales,
      0
    ),
    activeCustomers: toNumber(
      source.activeCustomers ?? source.uniqueClients ?? salesAnalysis.uniqueClients,
      0
    ),
    lowStockItems: toNumber(
      source.lowStockItems ??
        source.lowStockProducts ??
        inventory.lowStockProducts,
      0
    ),
  };

  const dailyCashbox = toOptionalNumber(
    source.dailyCashbox ?? source.dailyCash ?? summary.dailyCash
  );
  if (dailyCashbox !== undefined) normalized.dailyCashbox = dailyCashbox;

  const walkInCustomers = toOptionalNumber(source.walkInCustomers);
  if (walkInCustomers !== undefined) normalized.walkInCustomers = walkInCustomers;

  const pendingBulkOrders = toOptionalNumber(source.pendingBulkOrders);
  if (pendingBulkOrders !== undefined) {
    normalized.pendingBulkOrders = pendingBulkOrders;
  }

  const creditUtilized = toOptionalNumber(source.creditUtilized);
  if (creditUtilized !== undefined) normalized.creditUtilized = creditUtilized;

  const operationalExpenses = toOptionalNumber(
    source.operationalExpenses ?? summary.operationalExpenses
  );
  if (operationalExpenses !== undefined) {
    normalized.operationalExpenses = operationalExpenses;
  }

  const totalCostOfGoods = toOptionalNumber(
    source.totalCostOfGoods ?? summary.totalCostOfGoods
  );
  if (totalCostOfGoods !== undefined) {
    normalized.totalCostOfGoods = totalCostOfGoods;
  }

  const netProfit = toOptionalNumber(source.netProfit ?? summary.netProfit);
  if (netProfit !== undefined) normalized.netProfit = netProfit;

  const averageTicket = toOptionalNumber(
    source.averageTicket ?? salesAnalysis.averageTicket
  );
  if (averageTicket !== undefined) normalized.averageTicket = averageTicket;

  const growthTrend = toOptionalString(
    source.growthTrend ?? salesAnalysis.growthTrend
  );
  if (growthTrend !== undefined) normalized.growthTrend = growthTrend;

  const retentionRate = toOptionalString(source.retentionRate);
  if (retentionRate !== undefined) normalized.retentionRate = retentionRate;

  return normalized;
}
