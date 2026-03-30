import type {
  AnalyticsGroupBy,
  AnalyticsMetric,
  AnalyticsSalesResponse,
} from "@/lib/api-types";
import { backendApi } from "@/lib/backend-api";

type DateRange = {
  from: Date;
  to: Date;
};

export type FilledAnalyticsPoint = {
  period: string;
  value: number;
};

export type ReportingSalesMetricSeries = {
  metric: AnalyticsMetric;
  points: FilledAnalyticsPoint[];
  total: number;
};

function toYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
}

function parsePeriodDate(value: string, groupBy: AnalyticsGroupBy) {
  if (groupBy === "quarter" && value.includes("-Q")) {
    const [yearRaw, quarterRaw] = value.split("-Q");
    const year = Number(yearRaw);
    const quarter = Math.max(1, Number(quarterRaw || 1));
    return new Date(year, (quarter - 1) * 3, 1, 0, 0, 0, 0);
  }

  if (/^\d{4}$/.test(value)) {
    return new Date(Number(value), 0, 1, 0, 0, 0, 0);
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return parseYmd(`${value}-01`);
  }

  return parseYmd(value);
}

function formatPeriod(date: Date, groupBy: AnalyticsGroupBy) {
  if (groupBy === "day") return toYmd(date);
  if (groupBy === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (groupBy === "quarter") {
    return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  }
  return String(date.getFullYear());
}

function startOfBucket(date: Date, groupBy: AnalyticsGroupBy) {
  if (groupBy === "day") {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }
  if (groupBy === "month") {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }
  if (groupBy === "quarter") {
    const month = Math.floor(date.getMonth() / 3) * 3;
    return new Date(date.getFullYear(), month, 1, 0, 0, 0, 0);
  }
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function addBucket(date: Date, groupBy: AnalyticsGroupBy) {
  if (groupBy === "day") {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  }
  if (groupBy === "month") {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
  }
  if (groupBy === "quarter") {
    return new Date(date.getFullYear(), date.getMonth() + 3, 1, 0, 0, 0, 0);
  }
  return new Date(date.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
}

export function fillAnalyticsSeries(
  range: DateRange,
  groupBy: AnalyticsGroupBy,
  points: AnalyticsSalesResponse["points"]
) {
  const valuesByPeriod = new Map(
    (points ?? []).map((point) => [
      formatPeriod(parsePeriodDate(String(point.period), groupBy), groupBy),
      Number(point.value ?? 0),
    ])
  );

  const start = startOfBucket(range.from, groupBy);
  const end = startOfBucket(range.to, groupBy);
  const filled: FilledAnalyticsPoint[] = [];

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = addBucket(cursor, groupBy)
  ) {
    const period = formatPeriod(cursor, groupBy);
    filled.push({
      period,
      value: Number(valuesByPeriod.get(period) ?? 0),
    });
  }

  return filled;
}

export async function fetchReportingSalesSeries(
  range: DateRange,
  groupBy: AnalyticsGroupBy,
  metrics: AnalyticsMetric[]
) {
  const uniqueMetrics = Array.from(new Set(metrics));
  const responses = await Promise.all(
    uniqueMetrics.map((metric) =>
      backendApi.reporting.sales.history({
        from: toYmd(range.from),
        to: toYmd(range.to),
        groupBy,
        metric,
      })
    )
  );

  return uniqueMetrics.reduce<Record<AnalyticsMetric, ReportingSalesMetricSeries>>(
    (acc, metric, index) => {
      const response = responses[index];
      acc[metric] = {
        metric,
        points: fillAnalyticsSeries(range, groupBy, response.points),
        total: Number(response.totals?.value ?? 0),
      };
      return acc;
    },
    {} as Record<AnalyticsMetric, ReportingSalesMetricSeries>
  );
}

export function getPointDate(period: string, groupBy: AnalyticsGroupBy) {
  return parsePeriodDate(period, groupBy);
}
