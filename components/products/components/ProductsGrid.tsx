// components/products/components/ProductsGrid.tsx
import { Product } from "@/lib/products";
import { ProductsSkeletonGrid } from "./ProductSkeleton";
import { ProductsEmptyState } from "./ProductsEmptyState";
import { ProductCard } from "./ProductCard/ProductCard";

export function ProductsGrid(props: {
  isLoading: boolean;
  isEmpty: boolean;
  products: Product[];
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {props.isLoading ? (
        <ProductsSkeletonGrid />
      ) : props.isEmpty ? (
        <ProductsEmptyState />
      ) : (
        props.products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onEdit={props.onEdit}
            onDelete={props.onDelete}
          />
        ))
      )}
    </div>
  );
}
