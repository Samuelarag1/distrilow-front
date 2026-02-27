// components/products/components/ProductsSortBar.tsx
import { SortButton } from "./SortButton";
import { ProductsStats } from "./ProductStats";
import { SortKey, SortOrder } from "../types/Product";

export function ProductsSortBar(props: {
  activeBranchId: string | null;
  sortKey: SortKey;
  sortOrder: SortOrder;
  onSort: (key: SortKey) => void;
  productsCount: number;
  total: number;
  isLoadingMore: boolean;
}) {
  const disabled = !props.activeBranchId;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
      <span className="text-sm text-muted-foreground font-medium mr-2">
        Ordenar por:
      </span>

      <SortButton
        label="Nombre"
        sortKey="name"
        activeKey={props.sortKey}
        order={props.sortOrder}
        onClick={props.onSort}
        disabled={disabled}
      />
      <SortButton
        label="Precio"
        sortKey="price"
        activeKey={props.sortKey}
        order={props.sortOrder}
        onClick={props.onSort}
        disabled={disabled}
      />
      <SortButton
        label="Stock"
        sortKey="stock"
        activeKey={props.sortKey}
        order={props.sortOrder}
        onClick={props.onSort}
        disabled={disabled}
      />
      <SortButton
        label="Categoría"
        sortKey="category"
        activeKey={props.sortKey}
        order={props.sortOrder}
        onClick={props.onSort}
        disabled={disabled}
      />

      <ProductsStats
        visible={!!props.activeBranchId}
        count={props.productsCount}
        total={props.total}
        isLoadingMore={props.isLoadingMore}
      />
    </div>
  );
}
