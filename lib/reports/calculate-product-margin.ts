export type ProductMarginInput = {
  quantitySold: number;
  retailRevenue: number;
  wholesaleRevenue: number;
  costPrice: number;
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
  quantitySold,
  retailRevenue,
  wholesaleRevenue,
  costPrice,
}: ProductMarginInput): ProductMarginResult {
  const normalizedQuantitySold = toFiniteNumber(quantitySold);
  const normalizedRetailRevenue = toFiniteNumber(retailRevenue);
  const normalizedWholesaleRevenue = toFiniteNumber(wholesaleRevenue);
  const normalizedCostPrice = toFiniteNumber(costPrice);

  const totalRevenue = normalizedRetailRevenue + normalizedWholesaleRevenue;
  const totalCost = normalizedQuantitySold * normalizedCostPrice;
  const margin = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalCost,
    margin,
    marginPercent,
  };
}
