const WHOLE_NUMBER_FORMATTER = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

type DecimalParts = {
  integerDigits: string;
  fractionDigits: string;
  hasDecimalSeparator: boolean;
};

function resolveDecimalParts(
  value: string,
  maxFractionDigits: number
): DecimalParts {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[^\d,.\-]/g, "")
    .replace(/-/g, "");

  if (!cleaned) {
    return {
      integerDigits: "",
      fractionDigits: "",
      hasDecimalSeparator: false,
    };
  }

  const commaIndex = cleaned.lastIndexOf(",");
  const dotMatches = cleaned.match(/\./g) ?? [];
  let decimalSeparator: "," | "." | null = null;

  if (commaIndex >= 0) {
    decimalSeparator = ",";
  } else if (dotMatches.length === 1) {
    const dotIndex = cleaned.lastIndexOf(".");
    const rightDigits = cleaned.slice(dotIndex + 1).replace(/\D/g, "");
    if (rightDigits.length === 0 || rightDigits.length <= maxFractionDigits) {
      decimalSeparator = ".";
    }
  }

  if (!decimalSeparator) {
    return {
      integerDigits: cleaned.replace(/\D/g, "").replace(/^0+(?=\d)/, ""),
      fractionDigits: "",
      hasDecimalSeparator: false,
    };
  }

  const separatorIndex = cleaned.lastIndexOf(decimalSeparator);
  const integerDigits = cleaned
    .slice(0, separatorIndex)
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");
  const fractionDigits = cleaned
    .slice(separatorIndex + 1)
    .replace(/\D/g, "")
    .slice(0, maxFractionDigits);

  return {
    integerDigits,
    fractionDigits,
    hasDecimalSeparator: true,
  };
}

export function formatDecimalAmountInput(
  value: string,
  maxFractionDigits = 2
) {
  const { integerDigits, fractionDigits, hasDecimalSeparator } =
    resolveDecimalParts(value, maxFractionDigits);

  if (!integerDigits && !fractionDigits && !hasDecimalSeparator) return "";

  const safeIntegerDigits = integerDigits || "0";
  const formattedInteger = WHOLE_NUMBER_FORMATTER.format(
    Number(safeIntegerDigits)
  );

  if (!hasDecimalSeparator) return formattedInteger;
  return `${formattedInteger},${fractionDigits}`;
}

export function parseDecimalAmountInput(
  value: unknown,
  maxFractionDigits = 2
) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const { integerDigits, fractionDigits } = resolveDecimalParts(
    String(value ?? ""),
    maxFractionDigits
  );

  if (!integerDigits && !fractionDigits) return 0;

  const normalizedNumber = fractionDigits
    ? `${integerDigits || "0"}.${fractionDigits}`
    : integerDigits || "0";
  const parsed = Number(normalizedNumber);

  return Number.isFinite(parsed) ? parsed : 0;
}
