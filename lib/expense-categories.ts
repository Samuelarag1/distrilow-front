import type { ExpenseCategory } from "@/lib/api-types";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Alquiler",
  SERVICES: "Servicios",
  SALARIES: "Sueldos",
  SUPPLIES: "Insumos",
  MARKETING: "Marketing",
  MAINTENANCE: "Mantenimiento",
  TAXES: "Impuestos",
  LUZ: "Luz",
  DESCARTABLES: "Descartables",
  LIMPIEZA: "Limpieza",
  BOLSAS: "Bolsas",
  DESINFECCION: "Desinfeccion",
  NAFTA: "Nafta",
  MONOTRIBUTO: "Monotributo",
  VEHICULO_PARTICULAR: "Vehiculo Particular",
  OTHER: "Otros",
};

export const EXPENSE_CATEGORY_OPTIONS = (
  Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
).map((value) => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}));

export function getExpenseCategoryLabel(category: string | null | undefined) {
  if (!category) return "Sin categoria";

  const known = EXPENSE_CATEGORY_LABELS[category as ExpenseCategory];
  if (known) return known;

  return category
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
