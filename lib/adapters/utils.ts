export function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toOptionalFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = toFiniteNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toTrimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function toOptionalText(value: unknown) {
  const trimmed = toTrimmedText(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeIsoDate(
  ...values: unknown[]
) {
  for (const value of values) {
    const text = toOptionalText(value);
    if (text) {
      return text;
    }
  }

  return new Date().toISOString();
}
