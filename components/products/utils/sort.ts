import { ApiSortBy, SortKey, SortOrder } from "../types/product";

export function mapSort(
  sortKey: SortKey,
  sortOrder: SortOrder
): { sortBy: ApiSortBy; sortOrder: SortOrder } {
  if (sortKey === "price") return { sortBy: "retailPrice", sortOrder };
  if (sortKey === "name") return { sortBy: "name", sortOrder };

  // stock/category no son columnas reales ordenables en tu entidad (por ahora)
  return { sortBy: "name", sortOrder };
}
