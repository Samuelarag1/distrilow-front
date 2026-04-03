type PointLike = {
  period: string;
  value: number;
};

export type MonthSelection = {
  fromMonth: string;
  toMonth: string;
  from: Date;
  to: Date;
  fromYmd: string;
  toYmd: string;
};

export type MonthlySalesBreakdownRow = {
  period: string;
  label: string;
  shortLabel: string;
  revenue: number;
  orders: number;
  avgTicket: number;
};

function padMonth(value: number) {
  return String(value).padStart(2, "0");
}

function formatMonthPeriodLabel(
  period: string,
  style: "short" | "long" = "short"
) {
  const normalized = /^\d{4}-\d{2}$/.test(period) ? `${period}-01` : period;
  const parsed = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return period;
  }

  return new Intl.DateTimeFormat("es-AR", {
    month: style,
    ...(style === "long" ? { year: "numeric" as const } : {}),
  }).format(parsed);
}

function formatYmd(value: Date) {
  return [
    value.getFullYear(),
    padMonth(value.getMonth() + 1),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatMonthInputValue(value: Date) {
  return `${value.getFullYear()}-${padMonth(value.getMonth() + 1)}`;
}

export function parseMonthInputValue(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  const match = normalized.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;

  return new Date(year, month - 1, 1, 12, 0, 0, 0);
}

function startOfMonthValue(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonthValue(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
}

export function createMonthSelection(
  fallbackFrom: Date,
  fallbackTo: Date,
  value?: {
    fromMonth?: string | null;
    toMonth?: string | null;
  }
): MonthSelection {
  const parsedFrom =
    parseMonthInputValue(value?.fromMonth) ?? startOfMonthValue(fallbackFrom);
  const parsedTo =
    parseMonthInputValue(value?.toMonth) ?? startOfMonthValue(fallbackTo);

  const [fromBase, toBase] =
    parsedFrom.getTime() <= parsedTo.getTime()
      ? [parsedFrom, parsedTo]
      : [parsedTo, parsedFrom];

  const from = startOfMonthValue(fromBase);
  const to = endOfMonthValue(toBase);

  return {
    fromMonth: formatMonthInputValue(from),
    toMonth: formatMonthInputValue(toBase),
    from,
    to,
    fromYmd: formatYmd(from),
    toYmd: formatYmd(to),
  };
}

export function buildMonthlySalesBreakdownRows(
  revenuePoints: PointLike[],
  countPoints: PointLike[]
): MonthlySalesBreakdownRow[] {
  const ordersByPeriod = new Map(
    (countPoints ?? []).map((point) => [
      String(point.period ?? ""),
      Number(point.value ?? 0),
    ])
  );

  return (revenuePoints ?? []).map((point) => {
    const revenue = Number(point.value ?? 0);
    const orders = Number(ordersByPeriod.get(String(point.period ?? "")) ?? 0);
    const avgTicket = orders > 0 ? revenue / orders : 0;

    return {
      period: point.period,
      label: formatMonthPeriodLabel(point.period, "long"),
      shortLabel: formatMonthPeriodLabel(point.period, "short"),
      revenue,
      orders,
      avgTicket,
    };
  });
}
