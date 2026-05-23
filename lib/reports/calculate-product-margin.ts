export type ProductMarginInput = {
  totalRevenue: number;
  totalCost: number;
  retailRevenue?: number;
  wholesaleRevenue?: number;
};

export type ProductMarginResult = {
  totalRevenue: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
};

function toFiniteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateProductMargin({
  totalRevenue,
  totalCost,
}: ProductMarginInput): ProductMarginResult {
  const revenue = toFiniteNumber(totalRevenue);
  const cost = toFiniteNumber(totalCost);
  const margin = revenue - cost;
  const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
  return { totalRevenue: revenue, totalCost: cost, margin, marginPercent };
}
