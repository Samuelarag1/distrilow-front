export type SalesAnalysisPeriod = "monthly" | "quarterly" | "yearly";
export type SalesTrendGroupBy = "day" | "month" | "quarter" | "year";
const REPORTING_TIME_ZONE = "America/Argentina/Cordoba";

type SaleLike = {
  amount?: number | null;
  totalAmount?: number | null;
  customerName?: string | null;
  date: string;
  lifecycleStatus?: string | null;
};

export type SalesTrendRange = {
  from: Date;
  to: Date;
};

export type SalesTrendPoint = {
  key: string;
  start: Date;
  revenue: number;
  count: number;
  customers: number;
  avgTicket: number;
};

export type SalesTrendSummary = {
  points: SalesTrendPoint[];
  totals: {
    revenue: number;
    count: number;
    customers: number;
    avgTicket: number;
  };
};

type SalesTrendBucket = {
  key: string;
  start: Date;
  revenue: number;
  count: number;
  customerNames: Set<string>;
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function startOfDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0
  );
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfQuarter(value: Date) {
  const quarterStartMonth = Math.floor(value.getMonth() / 3) * 3;
  return new Date(value.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
}

function endOfQuarter(value: Date) {
  const quarterStartMonth = Math.floor(value.getMonth() / 3) * 3;
  return new Date(value.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
}

function startOfYear(value: Date) {
  return new Date(value.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfYear(value: Date) {
  return new Date(value.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function normalizeCustomerName(value: unknown) {
  if (typeof value !== "string") return "Consumidor Final";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Consumidor Final";
}

function getSaleRevenue(sale: SaleLike) {
  return toFiniteNumber(sale.totalAmount ?? sale.amount, 0);
}

function isActiveSale(sale: SaleLike) {
  return String(sale.lifecycleStatus ?? "ACTIVE").toUpperCase() !== "CANCELLED";
}

function isInRange(date: Date, range: SalesTrendRange) {
  const time = date.getTime();
  return time >= range.from.getTime() && time <= range.to.getTime();
}

function getBucketStart(date: Date, groupBy: SalesTrendGroupBy) {
  if (groupBy === "day") return startOfDay(date);
  if (groupBy === "month") return startOfMonth(date);
  if (groupBy === "quarter") return startOfQuarter(date);
  return startOfYear(date);
}

function addBucketStep(date: Date, groupBy: SalesTrendGroupBy) {
  if (groupBy === "day") {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1,
      0,
      0,
      0,
      0
    );
  }
  if (groupBy === "month") {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
  }
  if (groupBy === "quarter") {
    return new Date(date.getFullYear(), date.getMonth() + 3, 1, 0, 0, 0, 0);
  }
  return new Date(date.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
}

function formatBucketKey(date: Date, groupBy: SalesTrendGroupBy) {
  if (groupBy === "day") {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  if (groupBy === "month") {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${month}`;
  }

  if (groupBy === "quarter") {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()}-Q${quarter}`;
  }

  return String(date.getFullYear());
}

function buildBucketStarts(range: SalesTrendRange, groupBy: SalesTrendGroupBy) {
  const starts: Date[] = [];
  let cursor = getBucketStart(range.from, groupBy);
  const end = getBucketStart(range.to, groupBy);

  while (cursor.getTime() <= end.getTime()) {
    starts.push(cursor);
    cursor = addBucketStep(cursor, groupBy);
  }

  return starts;
}

export function getSalesAnalysisConfig(period: SalesAnalysisPeriod) {
  const now = new Date();

  if (period === "monthly") {
    const currentFrom = startOfMonth(now);
    const previousAnchor = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      current: { from: currentFrom, to: now },
      previous: {
        from: startOfMonth(previousAnchor),
        to: endOfMonth(previousAnchor),
      },
      groupBy: "day" as const,
      comparisonLabel: "mes",
      evolutionTitle: "Evolucion del Mes",
      revenueDescription: "Tendencia de ingresos por dia del mes actual",
      volumeDescription: "Volumen de operaciones por dia del mes actual",
      bestPointLabel: "Mejor dia",
    };
  }

  if (period === "quarterly") {
    const currentFrom = startOfQuarter(now);
    const previousAnchor = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    return {
      current: { from: currentFrom, to: now },
      previous: {
        from: startOfQuarter(previousAnchor),
        to: endOfQuarter(previousAnchor),
      },
      groupBy: "month" as const,
      comparisonLabel: "trimestre",
      evolutionTitle: "Evolucion del Trimestre",
      revenueDescription: "Tendencia de ingresos por mes del trimestre actual",
      volumeDescription: "Volumen de operaciones por mes del trimestre actual",
      bestPointLabel: "Mejor mes",
    };
  }

  return {
    current: { from: startOfYear(now), to: now },
    previous: {
      from: new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0),
      to: endOfYear(new Date(now.getFullYear() - 1, 0, 1)),
    },
    groupBy: "month" as const,
    comparisonLabel: "ano",
    evolutionTitle: "Evolucion del Ano",
    revenueDescription: "Tendencia de ingresos por mes del ano actual",
    volumeDescription: "Volumen de operaciones por mes del ano actual",
    bestPointLabel: "Mejor mes",
  };
}

export function filterSalesByRange<T extends SaleLike>(
  sales: T[],
  range: SalesTrendRange
) {
  return sales.filter((sale) => {
    if (!isActiveSale(sale)) return false;
    const saleDate = new Date(sale.date);
    if (Number.isNaN(saleDate.getTime())) return false;
    return isInRange(saleDate, range);
  });
}

export function aggregateSalesTrend<T extends SaleLike>(
  sales: T[],
  range: SalesTrendRange,
  groupBy: SalesTrendGroupBy
): SalesTrendSummary {
  const bucketStarts = buildBucketStarts(range, groupBy);
  const buckets = new Map<string, SalesTrendBucket>(
    bucketStarts.map((start) => {
      const key = formatBucketKey(start, groupBy);
      return [
        key,
        {
          key,
          start,
          revenue: 0,
          count: 0,
          customerNames: new Set<string>(),
        },
      ];
    })
  );

  const uniqueCustomers = new Set<string>();

  filterSalesByRange(sales, range).forEach((sale) => {
    const saleDate = new Date(sale.date);
    const bucketStart = getBucketStart(saleDate, groupBy);
    const key = formatBucketKey(bucketStart, groupBy);
    const bucket = buckets.get(key);
    if (!bucket) return;

    const customerName = normalizeCustomerName(sale.customerName);
    const revenue = getSaleRevenue(sale);

    bucket.revenue += revenue;
    bucket.count += 1;
    bucket.customerNames.add(customerName);
    uniqueCustomers.add(customerName);
  });

  const points = bucketStarts.map((start) => {
    const key = formatBucketKey(start, groupBy);
    const bucket = buckets.get(key);
    const revenue = bucket?.revenue ?? 0;
    const count = bucket?.count ?? 0;
    const customers = bucket?.customerNames.size ?? 0;

    return {
      key,
      start,
      revenue,
      count,
      customers,
      avgTicket: count > 0 ? revenue / count : 0,
    };
  });

  const totalsRevenue = points.reduce((sum, point) => sum + point.revenue, 0);
  const totalsCount = points.reduce((sum, point) => sum + point.count, 0);

  return {
    points,
    totals: {
      revenue: totalsRevenue,
      count: totalsCount,
      customers: uniqueCustomers.size,
      avgTicket: totalsCount > 0 ? totalsRevenue / totalsCount : 0,
    },
  };
}

export function formatSalesTrendLabel(
  date: Date,
  groupBy: SalesTrendGroupBy,
  style: "short" | "long" = "short"
) {
  if (groupBy === "day") {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: REPORTING_TIME_ZONE,
      ...(style === "long" ? { year: "numeric" } : {}),
    }).format(date);
  }

  if (groupBy === "month") {
    return new Intl.DateTimeFormat("es-AR", {
      month: style === "long" ? "long" : "short",
      timeZone: REPORTING_TIME_ZONE,
      ...(style === "long" ? { year: "numeric" } : {}),
    }).format(date);
  }

  if (groupBy === "quarter") {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return style === "long" ? `Trimestre ${quarter} ${date.getFullYear()}` : `Q${quarter}`;
  }

  return String(date.getFullYear());
}
