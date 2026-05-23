import { apiClientFetch } from "./api-client";
import type { SnapshotMetricsResponse } from "./api-types";

export type BusinessType = "retail" | "wholesale";

export interface DashboardMetrics {
  period?: "monthly" | "quarterly" | "semiannual" | "annual";
  scope?: "active" | "all";
  range?: {
    from?: string;
    to?: string;
  };
  totalRevenue: number;
  operationalExpenses: number;
  netProfit: number;
  dailyCashbox: number;
  creditUtilized?: number;
  contractError?: string;
}

export class DashboardContractError extends Error {
  constructor(public readonly fields: string[]) {
    super(`Invalid dashboard summary contract: ${fields.join(", ")}`);
    this.name = "DashboardContractError";
  }
}

type DashboardRequiredNumberField =
  | "totalRevenue"
  | "operationalExpenses"
  | "netProfit"
  | "dailyCashbox";

export const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  totalRevenue: 0,
  operationalExpenses: 0,
  netProfit: 0,
  dailyCashbox: 0,
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readRequiredNumber(
  source: Record<string, unknown>,
  field: DashboardRequiredNumberField,
  invalidFields: string[]
) {
  const value = source[field];
  const parsed = typeof value === "number" ? value : NaN;
  if (!Number.isFinite(parsed)) {
    invalidFields.push(field);
    return 0;
  }
  return parsed;
}

function readOptionalNumber(source: Record<string, unknown>, field: string) {
  const value = source[field];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOptionalString(source: Record<string, unknown>, field: string) {
  const value = source[field];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readPeriod(value: unknown): DashboardMetrics["period"] {
  return value === "monthly" ||
    value === "quarterly" ||
    value === "semiannual" ||
    value === "annual"
    ? value
    : undefined;
}

function readScope(value: unknown): DashboardMetrics["scope"] {
  return value === "active" || value === "all" ? value : undefined;
}

export function parseDashboardMetrics(snapshot: unknown): DashboardMetrics {
  const source = asRecord(snapshot);
  const invalidFields: string[] = [];

  const metrics: DashboardMetrics = {
    period: readPeriod(source.period),
    scope: readScope(source.scope),
    totalRevenue: readRequiredNumber(source, "totalRevenue", invalidFields),
    operationalExpenses: readRequiredNumber(
      source,
      "operationalExpenses",
      invalidFields
    ),
    netProfit: readRequiredNumber(source, "netProfit", invalidFields),
    dailyCashbox: readRequiredNumber(source, "dailyCashbox", invalidFields),
  };

  const range = asRecord(source.range);
  const rangeFrom = readOptionalString(range, "from");
  const rangeTo = readOptionalString(range, "to");
  if (rangeFrom || rangeTo) {
    metrics.range = {
      from: rangeFrom,
      to: rangeTo,
    };
  }

  const creditUtilized = readOptionalNumber(source, "creditUtilized");
  if (creditUtilized !== undefined) {
    metrics.creditUtilized = creditUtilized;
  }

  if (invalidFields.length > 0) {
    throw new DashboardContractError(invalidFields);
  }

  return metrics;
}

export const getDashboardMetrics = async (
  type: BusinessType
): Promise<DashboardMetrics> => {
  void type;
  try {
    const response = await apiClientFetch.get<SnapshotMetricsResponse>(
      `/reporting/dashboard/summary?period=monthly&scope=active`,
      { branchScoped: true }
    );

    return parseDashboardMetrics(response);
  } catch (error) {
    return {
      ...EMPTY_DASHBOARD_METRICS,
      contractError:
        error instanceof DashboardContractError
          ? error.message
          : "No se pudo cargar el resumen del dashboard.",
    };
  }
};

export const getRecentSales = async (type: BusinessType) => {
  void type;
  try {
    return await apiClientFetch.get(`/sales`);
  } catch {
    return [];
  }
};
